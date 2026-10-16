import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { adminRoute, ANY_ADMIN } from "@/lib/http";
import type { AdminAccountRow, BoothAccountRow, ClassStat, Overview, ResultRow } from "@/lib/admin-types";
import { boothDayStart, currentBooth, onlineBoothPath } from "@/lib/booth";
import { openState } from "@/lib/categories";
import { canManage, isSide, resultCategories, visibleCategories, visibleSides } from "@/lib/sides";

export async function GET() {
  return adminRoute(ANY_ADMIN, async (admin) => {
    const supabase = db();
    const isMaster = admin.role === "MASTER";
    const [settings, stats, accounts, booths, thisBooth, adminAccounts] = await Promise.all([
      supabase.from("settings").select("*").eq("id", 1).single(),
      supabase.rpc("token_stats"),
      supabase.from("booth_accounts").select("id, name, side").order("name"),
      supabase
        .from("booths")
        .select("id, name, created_at, account_id")
        .eq("active", true)
        // Cookie bilik berlaku sampai akhir hari aktivasi (WIB); bilik dari hari sebelumnya sudah tidak bisa dipakai.
        .gte("created_at", new Date(boothDayStart() * 1000).toISOString())
        .order("created_at"),
      currentBooth(),
      isMaster ? supabase.from("admin_accounts").select("role, username").order("role") : null,
    ]);
    if (settings.error) throw settings.error;
    if (stats.error) throw stats.error;
    if (accounts.error) throw accounts.error;
    if (booths.error) throw booths.error;
    if (adminAccounts?.error) throw adminAccounts.error;

    const open = openState(settings.data);
    const published = settings.data.results_published === true;
    const sides = visibleSides(admin.role);

    // Master melihat semua akun (termasuk akun lama tanpa sisi); admin sisi hanya akun sisinya.
    const accountRows: BoothAccountRow[] = accounts.data
      .filter((a) => isMaster || a.side === admin.role)
      .map((a) => {
        const device = booths.data.find((b) => b.account_id === a.id);
        return {
          id: a.id,
          name: a.name,
          side: isSide(a.side) ? a.side : null,
          device: device ? { id: device.id, name: device.name, created_at: device.created_at } : null,
        };
      });

    let shown = resultCategories(admin.role, open, published);
    let results: ResultRow[] | null = null;
    if (shown.length > 0) {
      const { data, error } = await supabase.rpc("election_results");
      if (error) throw error;
      // Status dibaca ulang setelah hasil: kategori yang baru saja dibuka di antara
      // kedua pembacaan tidak boleh ikut terkirim.
      const recheck = await supabase.from("settings").select("*").eq("id", 1).single();
      if (recheck.error) throw recheck.error;
      const reopened = openState(recheck.data);
      shown = shown.filter((c) => !reopened[c]);
      results = (data as ResultRow[]).filter((r) => (shown as string[]).includes(r.category));
      if (results.length === 0) results = null;
    }

    const classes = (stats.data as ClassStat[])
      .filter((c) => canManage(admin.role, c.category))
      .map((c) => ({ ...c, total: Number(c.total), used: Number(c.used) }));

    return NextResponse.json({
      role: admin.role,
      voting: visibleCategories(admin.role).map((category) => ({ category, open: open[category] })),
      resultsPublished: published,
      accounts: accountRows,
      thisBooth: thisBooth && sides.includes(thisBooth.side) ? thisBooth.name : null,
      classes,
      results,
      onlineLinks: sides.map((side) => ({ side, path: onlineBoothPath(side) })),
      adminAccounts: isMaster ? ((adminAccounts?.data ?? []) as AdminAccountRow[]) : null,
    } satisfies Overview);
  });
}
