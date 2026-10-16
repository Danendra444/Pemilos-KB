import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isCategory } from "@/lib/categories";
import { ANY_ADMIN, adminRoute, fail } from "@/lib/http";
import { canManage } from "@/lib/sides";

// Daftar token satu kelas beserta status terpakai. Tidak ada data pilihan
// maupun waktu pemakaian, jadi daftar ini tidak membuka rahasia suara.
export async function GET(req: Request) {
  return adminRoute(ANY_ADMIN, async (admin) => {
    const params = new URL(req.url).searchParams;
    const className = params.get("kelas")?.trim() ?? "";
    const category = params.get("kategori");
    if (className.length < 1 || className.length > 40) return fail(400, "Kelas tidak valid.");
    // Kategori sisi lain dijawab "tidak ditemukan" agar keberadaannya tidak bocor.
    if (!isCategory(category) || !canManage(admin.role, category)) return fail(404, "Kelas tidak ditemukan.");

    const { data, error } = await db()
      .from("tokens")
      .select("code, student_name, used")
      .eq("class_name", className)
      .eq("category", category)
      .order("student_name", { nullsFirst: false })
      .order("created_at")
      .order("code");
    if (error) throw error;

    return NextResponse.json({ tokens: data });
  });
}
