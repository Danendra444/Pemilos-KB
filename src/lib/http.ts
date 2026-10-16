import "server-only";
import { NextResponse } from "next/server";
import { currentAdmin, type Admin } from "./admin-auth";
import type { AdminRole } from "./sides";

export const ANY_ADMIN: readonly AdminRole[] = ["MASTER", "PUTRA", "PUTRI"];
export const MASTER_ONLY: readonly AdminRole[] = ["MASTER"];

export function fail(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Menjalankan handler admin. Setiap route wajib menyebut peran yang boleh memanggilnya.
 * Belum login → 401; peran tidak diizinkan → 403. Detail error disembunyikan.
 */
export async function adminRoute(roles: readonly AdminRole[], handler: (admin: Admin) => Promise<Response>): Promise<Response> {
  try {
    const admin = await currentAdmin();
    if (!admin) return fail(401, "Silakan masuk sebagai admin.");
    if (!roles.includes(admin.role)) return fail(403, "Akun ini tidak punya akses ke fitur ini.");
    return await handler(admin);
  } catch (err) {
    console.error("[admin]", err instanceof Error ? err.message : JSON.stringify(err));
    return fail(500, "Terjadi kesalahan server. Coba lagi.");
  }
}
