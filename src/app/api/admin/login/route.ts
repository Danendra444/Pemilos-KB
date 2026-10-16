import { NextResponse } from "next/server";
import { checkAdminLogin, startSession } from "@/lib/admin-auth";
import { isBlocked, recordFailure } from "@/lib/rate-limit";
import { fail, readJson } from "@/lib/http";

export async function POST(req: Request) {
  try {
    if (await isBlocked(req, "admin")) {
      return fail(429, "Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi.");
    }
    const body = await readJson(req);
    const role = await checkAdminLogin(body?.username, body?.password);
    if (!role) {
      await recordFailure(req, "admin");
      return fail(401, "Username atau password salah.");
    }
    await startSession(role);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/login]", err instanceof Error ? err.message : JSON.stringify(err));
    return fail(500, "Terjadi kesalahan server. Coba lagi.");
  }
}
