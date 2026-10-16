import "server-only";
import { createHmac } from "node:crypto";
import { db } from "./supabase";

// Hanya percobaan GAGAL yang dihitung, jadi banyak siswa di balik satu IP
// sekolah tidak saling memblokir selama mereka mengetik token dengan benar.
export const LIMITS = {
  token: { max: 30, windowSeconds: 10 * 60 },
  admin: { max: 10, windowSeconds: 15 * 60 },
  booth: { max: 10, windowSeconds: 15 * 60 },
} as const;

type Scope = keyof typeof LIMITS;

function clientKey(req: Request, scope: Scope, subject?: string): string {
  // Untuk bilik, batas dihitung per bilik: semua bilik di sekolah memakai satu IP publik yang sama.
  if (subject) return `${scope}:${subject}`;
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  // IP tidak disimpan mentah.
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  return `${scope}:${createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32)}`;
}

export async function isBlocked(req: Request, scope: Scope, subject?: string): Promise<boolean> {
  const { max, windowSeconds } = LIMITS[scope];
  const { data, error } = await db().rpc("rate_limit_blocked", {
    p_key: clientKey(req, scope, subject),
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data === true;
}

export async function recordFailure(req: Request, scope: Scope, subject?: string): Promise<void> {
  const { error } = await db().rpc("rate_limit_fail", {
    p_key: clientKey(req, scope, subject),
    p_window_seconds: LIMITS[scope].windowSeconds,
  });
  if (error) throw error;
}
