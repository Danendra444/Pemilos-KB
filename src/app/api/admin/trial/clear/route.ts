import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { MASTER_ONLY, adminRoute, fail } from "@/lib/http";
import { TRIAL_CLASS_NAMES } from "@/lib/classes";
import { openState } from "@/lib/categories";

// Menghapus token kelas uji coba dan mengembalikan semua suara ke 0, tanpa menyentuh token siswa.
// Karena suara tidak terhubung ke token, penghitungan hanya bisa dinolkan seluruhnya. Maka
// ditolak jika ada token di luar kelas uji coba yang sudah terpakai (suara sungguhan sudah masuk).
export async function POST() {
  return adminRoute(MASTER_ONLY, async () => {
    const settings = await db().from("settings").select("*").eq("id", 1).single();
    if (settings.error) throw settings.error;
    // Selama semua kategori tertutup, cast_vote menolak semua suara, jadi tidak ada suara baru di tengah pembersihan.
    if (Object.values(openState(settings.data)).some(Boolean)) {
      return fail(409, "Tutup pemungutan suara semua kategori terlebih dahulu.");
    }

    const [usedAll, usedTrial] = await Promise.all([
      db().from("tokens").select("code", { count: "exact", head: true }).eq("used", true),
      db().from("tokens").select("code", { count: "exact", head: true }).eq("used", true).in("class_name", TRIAL_CLASS_NAMES),
    ]);
    if (usedAll.error) throw usedAll.error;
    if (usedTrial.error) throw usedTrial.error;
    if ((usedAll.count ?? 0) !== (usedTrial.count ?? 0)) {
      return fail(409, "Sudah ada token siswa yang terpakai, jadi suara tidak bisa dinolkan. Data tidak diubah.");
    }

    const deleted = await db().from("tokens").delete().in("class_name", TRIAL_CLASS_NAMES).select("code");
    if (deleted.error) throw deleted.error;

    const counts = await db().from("vote_counts").update({ count: 0 }).gte("candidate_id", 0);
    if (counts.error) throw counts.error;
    const published = await db().from("settings").update({ results_published: false }).eq("id", 1);
    if (published.error) throw published.error;
    const limits = await db().from("rate_limits").delete().neq("key", "");
    if (limits.error) throw limits.error;

    return NextResponse.json({ deleted: deleted.data.length });
  });
}
