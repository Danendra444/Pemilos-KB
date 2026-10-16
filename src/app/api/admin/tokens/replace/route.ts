import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { generateToken, normalizeToken } from "@/lib/token";
import { ANY_ADMIN, adminRoute, fail, readJson } from "@/lib/http";
import { canManage } from "@/lib/sides";

// Untuk slip yang hilang: kode token diganti sehingga slip lama tidak berlaku,
// dan siswa yang sama mendapat kode baru. Hanya token yang belum terpakai.
export async function POST(req: Request) {
  return adminRoute(ANY_ADMIN, async (admin) => {
    const body = await readJson(req);
    const code = normalizeToken(body?.code);
    if (!code) return fail(400, "Token tidak valid.");

    const supabase = db();
    const { data: token, error: findError } = await supabase.from("tokens").select("category").eq("code", code).maybeSingle();
    if (findError) throw findError;
    if (!token || !canManage(admin.role, token.category)) return fail(404, "Token tidak ditemukan.");
    for (let attempt = 0; attempt < 10; attempt++) {
      // Satu UPDATE ... WHERE NOT used: jika siswa sedang memilih bersamaan, salah satu saja yang berhasil.
      const { data, error } = await supabase
        .from("tokens")
        .update({ code: generateToken() })
        .eq("code", code)
        .eq("used", false)
        .select("code");
      if (error) {
        if (error.code === "23505") continue; // kode baru bentrok dengan token lain; acak lagi
        throw error;
      }
      if (data.length === 0) return fail(409, "Token sudah terpakai atau tidak ditemukan.");
      return NextResponse.json({ code: data[0].code });
    }
    throw new Error("could not generate a unique token");
  });
}
