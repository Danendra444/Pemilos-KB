import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { MASTER_ONLY, adminRoute, fail, readJson } from "@/lib/http";

export async function POST(req: Request) {
  return adminRoute(MASTER_ONLY, async () => {
    const body = await readJson(req);
    if (body?.confirm !== "RESET") return fail(400, 'Ketik "RESET" untuk konfirmasi.');
    const { error } = await db().rpc("reset_election");
    if (error) throw error;
    return NextResponse.json({ ok: true });
  });
}
