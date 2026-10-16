import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./supabase";
import { verifyPassword } from "./password";
import { boothUsername } from "./booth-username";
import type { AdminRole, Side } from "./sides";

export const ADMIN_COOKIE = "osis_admin";
const SESSION_SECONDS = 12 * 60 * 60;
const UUID = /^[0-9a-f-]{36}$/;

export type Admin = { role: AdminRole; sessionId: string };

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET wajib diisi (minimal 32 karakter).");
  }
  return s;
}

export function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function masterUsername(): string {
  // trim: spasi/baris baru sering ikut tersalin saat mengisi env var di dashboard.
  const user = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  if (!user) throw new Error("ADMIN_USERNAME wajib diisi.");
  return user;
}

/** Mengembalikan peran jika username dan password benar, selain itu null. */
export async function checkAdminLogin(username: unknown, password: unknown): Promise<AdminRole | null> {
  const expectedUser = masterUsername();
  const expectedPass = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedPass) throw new Error("ADMIN_PASSWORD wajib diisi.");
  if (typeof username !== "string" || typeof password !== "string") return null;

  // Keduanya selalu dibandingkan agar waktu respons tidak membocorkan mana yang salah.
  const userOk = safeEqual(username.trim().toLowerCase(), expectedUser);
  const passOk = safeEqual(password.trim(), expectedPass);
  if (userOk) return passOk ? "MASTER" : null;

  const { data, error } = await db()
    .from("admin_accounts")
    .select("role, password_hash")
    .eq("username", boothUsername(username))
    .maybeSingle();
  if (error) throw error;
  if (!data || !(await verifyPassword(password, data.password_hash))) return null;
  return data.role as Side;
}

function sessionMac(id: string, expires: string): string {
  return sign(`admin:${id}:${expires}`);
}

/** Cookie: <id sesi>.<kedaluwarsa>.<tanda tangan>. Format lama (tanpa id) ditolak. */
function parseSession(value: string | undefined): string | null {
  if (!value) return null;
  const [id, expires, mac] = value.split(".");
  if (!id || !expires || !mac || !UUID.test(id)) return null;
  if (!safeEqual(mac, sessionMac(id, expires))) return null;
  if (Number(expires) < Date.now() / 1000) return null;
  return id;
}

/** Login baru menonaktifkan sesi lama peran yang sama: satu perangkat per peran. */
export async function startSession(role: AdminRole): Promise<void> {
  const supabase = db();
  // Indeks unik admin_sessions_one_active_per_role menolak dua sesi aktif;
  // jika login lain menyela di antara cabut dan insert, ulangi sekali.
  let id: string | null = null;
  for (let attempt = 0; !id; attempt++) {
    const { error: revokeError } = await supabase.from("admin_sessions").update({ active: false }).eq("role", role).eq("active", true);
    if (revokeError) throw revokeError;
    const result = await supabase.from("admin_sessions").insert({ role }).select("id").single();
    if (result.error?.code === "23505" && attempt === 0) continue;
    if (result.error) throw result.error;
    id = result.data.id as string;
  }

  const expires = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  (await cookies()).set(ADMIN_COOKIE, `${id}.${expires}.${sessionMac(id, expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function currentAdmin(): Promise<Admin | null> {
  const id = parseSession((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!id) return null;
  const { data, error } = await db().from("admin_sessions").select("role").eq("id", id).eq("active", true).maybeSingle();
  if (error) throw error;
  return data ? { role: data.role as AdminRole, sessionId: id } : null;
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const id = parseSession(store.get(ADMIN_COOKIE)?.value);
  // Cookie dihapus lebih dulu agar perangkat ini tetap keluar walau database gagal.
  store.delete(ADMIN_COOKIE);
  if (id) {
    const { error } = await db().from("admin_sessions").update({ active: false }).eq("id", id);
    if (error) throw error;
  }
}

/** Mengeluarkan perangkat yang sedang login dengan peran ini (mis. setelah password diganti). */
export async function endSessionsFor(role: AdminRole): Promise<void> {
  const { error } = await db().from("admin_sessions").update({ active: false }).eq("role", role).eq("active", true);
  if (error) throw error;
}
