import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { adminRoute, fail, MASTER_ONLY } from "@/lib/http";
import { CATEGORIES, openColumn } from "@/lib/categories";

// Master mengumumkan hasil ke panitia putra dan putri. Hanya jika semua kategori tertutup.
export async function POST() {
  return adminRoute(MASTER_ONLY, async () => {
    let query = db().from("settings").update({ results_published: true }).eq("id", 1);
    for (const c of CATEGORIES) query = query.eq(openColumn(c), false);
    const { data, error } = await query.select("id");
    if (error) throw error;
    if (data.length === 0) return fail(409, "Tutup pemungutan suara semua kategori terlebih dahulu.");
    return NextResponse.json({ ok: true });
  });
}
