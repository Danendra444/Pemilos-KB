import { createHmac, randomBytes, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Menguji server dev lokal (npm run dev) dengan database Supabase lokal dari .env.local.
export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
if (!process.env.SUPABASE_URL?.includes("127.0.0.1")) {
  throw new Error("Tes integrasi hanya boleh memakai Supabase lokal.");
}

export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Role = "MASTER" | "PUTRA" | "PUTRI";
export type Side = "PUTRA" | "PUTRI";

const sign = (payload: string) => createHmac("sha256", process.env.ADMIN_SESSION_SECRET!).update(payload).digest("hex");
const expires = () => String(Math.floor(Date.now() / 1000) + 3600);

/** Sesi admin dibuat langsung di database, sama seperti hasil login. */
export async function adminCookie(role: Role): Promise<string> {
  const revoke = await db.from("admin_sessions").update({ active: false }).eq("role", role).eq("active", true);
  if (revoke.error) throw revoke.error;
  const { data, error } = await db.from("admin_sessions").insert({ role }).select("id").single();
  if (error) throw error;
  const exp = expires();
  return `osis_admin=${data.id}.${exp}.${sign(`admin:${data.id}:${exp}`)}`;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 32).toString("hex")}`;
}

const createdBoothAccounts: string[] = [];

/** Bilik aktif untuk sisi tertentu (null = akun lama tanpa sisi). */
export async function boothCookie(side: Side | null): Promise<{ cookie: string; boothId: string }> {
  const name = `zztest-${randomBytes(4).toString("hex")}`;
  const account = await db.from("booth_accounts").insert({ name, password_hash: hashPassword("zztest-pass"), side }).select("id").single();
  if (account.error) throw account.error;
  createdBoothAccounts.push(account.data.id);
  const booth = await db.from("booths").insert({ name, account_id: account.data.id }).select("id").single();
  if (booth.error) throw booth.error;
  const exp = expires();
  return { cookie: `osis_bilik=${booth.data.id}.${exp}.${sign(`booth:${booth.data.id}:${exp}`)}`, boothId: booth.data.id };
}

export const TEST_CLASS = "ZZTEST";
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export async function makeToken(category: string, studentName: string | null = null): Promise<string> {
  const code = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
  const { error } = await db.from("tokens").insert({ code, category, class_name: TEST_CLASS, student_name: studentName });
  if (error) throw error;
  return code;
}

type Settings = {
  voting_open_smp_putra: boolean;
  voting_open_sma_putra: boolean;
  voting_open_smp_putri: boolean;
  voting_open_sma_putri: boolean;
  results_published: boolean;
};

export async function getSettings(): Promise<Settings> {
  const { data, error } = await db.from("settings").select("voting_open_smp_putra, voting_open_sma_putra, voting_open_smp_putri, voting_open_sma_putri, results_published").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function setSettings(values: Partial<Settings>): Promise<void> {
  const { error } = await db.from("settings").update(values).eq("id", 1);
  if (error) throw error;
}

export async function cleanup(): Promise<void> {
  // Tes sengaja mencoba password salah; hapus hitungannya agar tes berikutnya tidak terblokir.
  await db.from("rate_limits").delete().like("key", "admin:%");
  await db.from("tokens").delete().eq("class_name", TEST_CLASS);
  await db.from("tokens").delete().like("student_name", "ZZTEST%");
  if (createdBoothAccounts.length > 0) {
    await db.from("booth_accounts").delete().in("id", createdBoothAccounts.splice(0));
  }
}

export async function call(path: string, opts: { cookie?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, {
    method: opts.body === undefined ? "GET" : "POST",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    redirect: "manual",
  });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text, headers: res.headers };
}
