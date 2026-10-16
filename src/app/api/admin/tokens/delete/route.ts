import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { normalizeToken } from "@/lib/token";
import { isCategory } from "@/lib/categories";
import { MASTER_ONLY, adminRoute, fail, readJson } from "@/lib/http";

// Menghapus satu token ({ code }) atau semua token satu kelas ({ className, category }).
// Hanya token yang belum terpakai: token terpakai tetap disimpan agar angka
// partisipasi tidak berubah. WHERE used = false juga membuat penghapusan aman
// jika siswa sedang memilih pada saat yang sama.
export async function POST(req: Request) {
  return adminRoute(MASTER_ONLY, async () => {
    const body = await readJson(req);
    let query = db().from("tokens").delete().eq("used", false);

    if (body?.code !== undefined) {
      const code = normalizeToken(body.code);
      if (!code) return fail(400, "Token tidak valid.");
      query = query.eq("code", code);
    } else {
      const className = typeof body?.className === "string" ? body.className.trim() : "";
      if (className.length < 1 || className.length > 40) return fail(400, "Kelas tidak valid.");
      if (!isCategory(body?.category)) return fail(400, "Kategori tidak valid.");
      query = query.eq("class_name", className).eq("category", body.category);
    }

    const { data, error } = await query.select("code");
    if (error) throw error;
    if (data.length === 0) return fail(409, "Tidak ada token belum terpakai yang bisa dihapus.");

    return NextResponse.json({ deleted: data.length });
  });
}
