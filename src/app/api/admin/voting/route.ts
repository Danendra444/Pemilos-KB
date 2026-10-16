import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { adminRoute, ANY_ADMIN, fail, readJson } from "@/lib/http";
import { isCategory, openColumn } from "@/lib/categories";
import { canManage } from "@/lib/sides";

// Membuka/menutup pemungutan suara satu kategori (SMP dan SMA memilih di hari berbeda).
// Admin sisi hanya kategori sisinya; master semuanya.
export async function POST(req: Request) {
  return adminRoute(ANY_ADMIN, async (admin) => {
    const body = await readJson(req);
    const category = body?.category;
    if (!isCategory(category) || typeof body?.open !== "boolean") return fail(400, "Permintaan tidak valid.");
    if (!canManage(admin.role, category)) return fail(404, "Tidak ditemukan.");

    const column = openColumn(category);
    // Membuka lagi sebuah kategori membatalkan pengumuman hasil.
    const values = body.open ? { [column]: true, results_published: false } : { [column]: false };
    const { error } = await db().from("settings").update(values).eq("id", 1);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  });
}
