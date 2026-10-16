import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { normalizeToken } from "@/lib/token";
import { isBlocked, recordFailure } from "@/lib/rate-limit";
import { fail, readJson } from "@/lib/http";
import { boothRateSubject, currentBooth, DEMO_TRIAL_ONLY, NOT_A_BOOTH, ONLINE_TEACHER_ONLY } from "@/lib/booth";
import { teacherClassesOf, TRIAL_CLASS_NAMES } from "@/lib/classes";

const RESULT: Record<string, { status: number; message: string }> = {
  VOTING_CLOSED: { status: 403, message: "Pemungutan suara belum dibuka atau sudah ditutup." },
  INVALID_CANDIDATE: { status: 400, message: "Pilihan tidak valid. Silakan ulangi." },
  TOKEN_INVALID: { status: 404, message: "Token tidak ditemukan." },
  TOKEN_USED: { status: 409, message: "Token ini sudah digunakan." },
  CATEGORY_MISMATCH: { status: 400, message: "Pilihan tidak sesuai dengan kategori tokenmu." },
  WRONG_BOOTH: { status: 403, message: "Token ini bukan untuk bilik ini." },
};

// Jangan pernah mencatat (log) isi permintaan ini: berisi token + pilihan.
export async function POST(req: Request) {
  try {
    const booth = await currentBooth();
    if (!booth) return fail(403, NOT_A_BOOTH);

    if (await isBlocked(req, "token", boothRateSubject(booth))) {
      return fail(429, "Terlalu banyak percobaan yang salah. Tunggu beberapa menit lalu coba lagi.");
    }

    const body = await readJson(req);
    const code = normalizeToken(body?.token);
    const candidateId = body?.candidateId;
    if (!code || !Number.isInteger(candidateId)) {
      return fail(400, "Permintaan tidak valid.");
    }

    // Bilik demo hanya menerima token kelas Uji Coba, bilik online hanya token guru sisinya;
    // token lain ditolak sebelum suara dicatat.
    if (booth.demo || booth.online) {
      const allowed = booth.demo ? TRIAL_CLASS_NAMES : teacherClassesOf(booth.side);
      const { data: token, error } = await db().from("tokens").select("class_name").eq("code", code).maybeSingle();
      if (error) throw error;
      if (!token || !allowed.includes(token.class_name)) {
        await recordFailure(req, "token", boothRateSubject(booth));
        return fail(403, booth.demo ? DEMO_TRIAL_ONLY : ONLINE_TEACHER_ONLY);
      }
    }

    // Seluruh pengecekan dan pencatatan terjadi di satu transaksi Postgres.
    const { data, error } = await db().rpc("cast_vote", {
      p_token: code,
      p_candidate_id: candidateId,
      p_side: booth.side,
    });
    if (error) throw error;

    if (data === "OK") return NextResponse.json({ ok: true });

    // Token salah, token sisi lain, atau token kategori lain dihitung sebagai percobaan gagal.
    if (data === "TOKEN_INVALID" || data === "WRONG_BOOTH" || data === "CATEGORY_MISMATCH") {
      await recordFailure(req, "token", boothRateSubject(booth));
    }
    const result = RESULT[String(data)] ?? { status: 500, message: "Terjadi kesalahan server. Coba lagi." };
    return fail(result.status, result.message);
  } catch (err) {
    console.error("[vote]", err instanceof Error ? err.message : "unknown error");
    return fail(500, "Terjadi kesalahan server. Coba lagi, atau hubungi panitia jika masih gagal.");
  }
}
