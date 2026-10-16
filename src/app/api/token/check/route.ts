import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { normalizeToken } from "@/lib/token";
import { CATEGORY_LABEL, isCategory, openState, type Candidate } from "@/lib/categories";
import { isBlocked, recordFailure } from "@/lib/rate-limit";
import { fail, readJson } from "@/lib/http";
import { boothRateSubject, currentBooth, DEMO_TRIAL_ONLY, NOT_A_BOOTH, ONLINE_TEACHER_ONLY } from "@/lib/booth";
import { teacherClassesOf, TRIAL_CLASS_NAMES } from "@/lib/classes";
import { SIDE_LABEL, sideOf } from "@/lib/sides";

// Memeriksa token TANPA memakainya. Token baru dipakai di /api/vote.
export async function POST(req: Request) {
  try {
    const booth = await currentBooth();
    if (!booth) return fail(403, NOT_A_BOOTH);

    if (await isBlocked(req, "token", boothRateSubject(booth))) {
      return fail(429, "Terlalu banyak percobaan yang salah. Tunggu beberapa menit lalu coba lagi.");
    }

    const body = await readJson(req);
    const code = normalizeToken(body?.token);
    if (!code) {
      await recordFailure(req, "token", boothRateSubject(booth));
      return fail(400, "Token harus 6 karakter. Periksa kembali kertas tokenmu.");
    }

    const supabase = db();
    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .select("category, class_name, used")
      .eq("code", code)
      .maybeSingle();
    if (tokenError) throw tokenError;
    if (!token || !isCategory(token.category)) {
      await recordFailure(req, "token", boothRateSubject(booth));
      return fail(404, "Token tidak ditemukan. Periksa kembali kertas tokenmu.");
    }

    if (booth.demo && !TRIAL_CLASS_NAMES.includes(token.class_name)) {
      await recordFailure(req, "token", boothRateSubject(booth));
      return fail(403, DEMO_TRIAL_ONLY);
    }

    if (booth.online && !teacherClassesOf(booth.side).includes(token.class_name)) {
      await recordFailure(req, "token", boothRateSubject(booth));
      return fail(403, ONLINE_TEACHER_ONLY);
    }

    // Bilik putra hanya melayani token putra, dan sebaliknya. Dihitung sebagai
    // percobaan gagal agar bilik tidak bisa dipakai menebak token sisi lain.
    if (sideOf(token.category) !== booth.side) {
      await recordFailure(req, "token", boothRateSubject(booth));
      return fail(403, `Token ini bukan untuk bilik ini. Bilik ini khusus pemilih ${SIDE_LABEL[booth.side].toLowerCase()}.`);
    }

    // SMP dan SMA memilih di hari berbeda: yang diperiksa kategori token ini.
    const { data: settings, error: settingsError } = await supabase.from("settings").select("*").eq("id", 1).single();
    if (settingsError) throw settingsError;
    if (!openState(settings)[token.category]) {
      return fail(403, `Pemungutan suara ${CATEGORY_LABEL[token.category]} belum dibuka atau sudah ditutup.`);
    }

    if (token.used) {
      await recordFailure(req, "token", boothRateSubject(booth));
      return fail(409, "Token ini sudah digunakan.");
    }

    const { data: candidates, error: candError } = await supabase
      .from("candidates")
      .select("id, number, name, is_blank")
      .eq("category", token.category)
      .order("number");
    if (candError) throw candError;

    return NextResponse.json({
      category: token.category,
      categoryLabel: CATEGORY_LABEL[token.category],
      candidates: candidates as Candidate[],
    });
  } catch (err) {
    console.error("[token/check]", err instanceof Error ? err.message : JSON.stringify(err));
    return fail(500, "Terjadi kesalahan server. Coba lagi.");
  }
}
