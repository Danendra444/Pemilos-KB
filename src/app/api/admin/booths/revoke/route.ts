import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { adminRoute, ANY_ADMIN, fail, readJson } from "@/lib/http";

// Mencabut bilik. Admin sisi hanya bilik dari akun sisinya; "all" = semua bilik yang boleh ia urus.
export async function POST(req: Request) {
  return adminRoute(ANY_ADMIN, async (admin) => {
    const body = await readJson(req);
    const id = body?.id;
    if (id !== "all" && (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id))) {
      return fail(400, "Permintaan tidak valid.");
    }

    const supabase = db();
    let query = supabase.from("booths").update({ active: false }).eq("active", true);
    if (admin.role !== "MASTER") {
      const { data: accounts, error } = await supabase.from("booth_accounts").select("id").eq("side", admin.role);
      if (error) throw error;
      query = query.in(
        "account_id",
        accounts.map((a) => a.id),
      );
    }
    const { data, error } = await (id === "all" ? query : query.eq("id", id)).select("id");
    if (error) throw error;
    if (id !== "all" && data.length === 0) return fail(404, "Bilik tidak ditemukan.");
    return NextResponse.json({ ok: true });
  });
}
