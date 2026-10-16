import { NextResponse } from "next/server";
import { endSession } from "@/lib/admin-auth";
import { fail } from "@/lib/http";

export async function POST() {
  try {
    await endSession();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/logout]", err instanceof Error ? err.message : JSON.stringify(err));
    return fail(500, "Terjadi kesalahan server. Coba lagi.");
  }
}
