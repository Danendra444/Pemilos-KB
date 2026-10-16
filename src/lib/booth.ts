import "server-only";
import { cookies } from "next/headers";
import { db } from "./supabase";
import { safeEqual, sign } from "./admin-auth";
import { boothUsername } from "./booth-username";
import { verifyPassword } from "./password";
import { isSide, type Side } from "./sides";

// Perangkat bilik ditandai dengan cookie httpOnly bertanda tangan server.
// Cookie hanya berlaku selama belum kedaluwarsa dan baris bilik di database masih aktif.
export const BOOTH_COOKIE = "osis_bilik";

// Bilik berlaku sampai akhir hari aktivasi (23.59.59 WIB), bukan 24 jam sejak aktivasi:
// bilik yang diaktifkan siang hari tidak boleh mati di tengah pemungutan suara esok harinya.
// Panitia mengaktifkan bilik setiap pagi hari pemilihan.
const DAY_SECONDS = 24 * 60 * 60;
const WIB_OFFSET_SECONDS = 7 * 60 * 60;

/** Awal hari ini (00.00 WIB) dalam detik Unix; bilik yang diaktifkan sebelumnya sudah tidak berlaku. */
export function boothDayStart(nowMs = Date.now()): number {
  const local = Math.floor(nowMs / 1000) + WIB_OFFSET_SECONDS;
  return local - (local % DAY_SECONDS) - WIB_OFFSET_SECONDS;
}

/** Akhir hari ini (23.59.59 WIB) dalam detik Unix. */
export function boothExpiry(nowMs = Date.now()): number {
  return boothDayStart(nowMs) + DAY_SECONDS - 1;
}

// Bilik demo: dibuka lewat tautan rahasia (env DEMO_BOOTH_KEY) tanpa akun bilik,
// hanya menerima token kelas Uji Coba, dan berhenti berlaku pada DEMO_UNTIL.
export const DEMO_BOOTH_COOKIE = "osis_bilik_demo";
export const DEMO_UNTIL = new Date("2026-09-27T23:59:59+07:00");

export type Booth = { id: string; name: string; side: Side; demo?: boolean; online?: boolean };
/** side null: akun lama sebelum pemisahan putra/putri; tidak bisa dipakai. */
export type BoothAccount = { id: string; name: string; side: Side | null };

function boothMac(id: string, expires: string): string {
  return sign(`booth:${id}:${expires}`);
}

/** Mengembalikan akun jika username dan kata sandinya benar, selain itu null. */
export async function checkBoothAccount(username: unknown, password: unknown): Promise<BoothAccount | null> {
  if (typeof username !== "string" || typeof password !== "string") return null;
  const wanted = boothUsername(username);
  if (!wanted) return null;
  const { data, error } = await db().from("booth_accounts").select("id, name, password_hash, side");
  if (error) throw error;
  const account = data.find((a) => boothUsername(a.name) === wanted);
  if (!account || !(await verifyPassword(password, account.password_hash))) return null;
  return { id: account.id, name: account.name, side: isSide(account.side) ? account.side : null };
}

function demoMac(side: Side, expires: string): string {
  return sign(`demo-booth:${side}:${expires}`);
}

export function demoBoothOpen(): boolean {
  return Date.now() < DEMO_UNTIL.getTime();
}

/** Mengembalikan true jika key sama dengan DEMO_BOOTH_KEY dan masa demo belum lewat. */
export function checkDemoKey(key: string): boolean {
  const wanted = process.env.DEMO_BOOTH_KEY;
  return !!wanted && wanted.length >= 16 && demoBoothOpen() && safeEqual(key, wanted);
}

/** Isi cookie bilik demo; berlaku sampai DEMO_UNTIL. */
export function demoBoothCookie(side: Side): string {
  const expires = String(Math.floor(DEMO_UNTIL.getTime() / 1000));
  return `${side}.${expires}.${demoMac(side, expires)}`;
}

function demoBooth(value: string | undefined): Booth | null {
  if (!value || !demoBoothOpen()) return null;
  const [side, expires, mac] = value.split(".");
  if (!isSide(side) || !expires || !mac || !safeEqual(mac, demoMac(side, expires))) return null;
  if (Number(expires) < Date.now() / 1000) return null;
  return { id: `demo-${side.toLowerCase()}`, name: `Bilik Demo ${side === "PUTRA" ? "Putra" : "Putri"}`, side, demo: true };
}

// Bilik online guru: dibuka lewat tautan bertanda tangan (lihat onlineBoothPath) tanpa akun bilik,
// untuk guru yang tidak bisa datang ke bilik. Hanya menerima token kelas guru sisinya;
// guru tetap memasukkan tokennya sendiri. Cookie berlaku sampai akhir hari (WIB) seperti bilik biasa.
export const ONLINE_BOOTH_COOKIE = "osis_bilik_online";

function onlineKey(side: Side): string {
  return sign(`online-booth-link:${side}`).slice(0, 24);
}

/** Tautan bilik online sisi ini, mis. /online/putra/<kunci>. Kuncinya diturunkan dari ADMIN_SESSION_SECRET. */
export function onlineBoothPath(side: Side): string {
  return `/online/${side.toLowerCase()}/${onlineKey(side)}`;
}

export function checkOnlineKey(side: Side, key: string): boolean {
  return safeEqual(key, onlineKey(side));
}

function onlineMac(side: Side, expires: string): string {
  return sign(`online-booth:${side}:${expires}`);
}

/** Isi cookie bilik online; berlaku sampai expires (detik Unix). */
export function onlineBoothCookie(side: Side, expires: number): string {
  return `${side}.${expires}.${onlineMac(side, String(expires))}`;
}

function onlineBooth(value: string | undefined): Booth | null {
  if (!value) return null;
  const [side, expires, mac] = value.split(".");
  if (!isSide(side) || !expires || !mac || !safeEqual(mac, onlineMac(side, expires))) return null;
  if (Number(expires) < Date.now() / 1000) return null;
  return { id: `online-${side.toLowerCase()}`, name: `Bilik Online Guru ${side === "PUTRA" ? "Putra" : "Putri"}`, side, online: true };
}

/** Bilik yang sedang dipakai perangkat ini: bilik akun jika masih aktif, selain itu bilik demo atau bilik online. */
export async function currentBooth(): Promise<Booth | null> {
  const jar = await cookies();
  return (
    (await accountBooth(jar.get(BOOTH_COOKIE)?.value)) ??
    demoBooth(jar.get(DEMO_BOOTH_COOKIE)?.value) ??
    onlineBooth(jar.get(ONLINE_BOOTH_COOKIE)?.value)
  );
}

/**
 * Subjek batas percobaan gagal. Bilik di sekolah dihitung per bilik (satu IP publik bersama);
 * bilik online dipakai dari banyak jaringan, jadi dihitung per IP agar satu orang tidak memblokir guru lain.
 */
export function boothRateSubject(booth: Booth): string | undefined {
  return booth.online ? undefined : `booth:${booth.id}`;
}

/** Bilik dari akun tanpa sisi tidak diterima. */
async function accountBooth(value: string | undefined): Promise<Booth | null> {
  if (!value) return null;
  const [id, expires, mac] = value.split(".");
  if (!id || !expires || !mac || !safeEqual(mac, boothMac(id, expires))) return null;
  if (Number(expires) < Date.now() / 1000) return null;

  const { data, error } = await db()
    .from("booths")
    .select("id, name, booth_accounts(side)")
    .eq("id", id)
    .eq("active", true)
    .not("account_id", "is", null)
    .maybeSingle();
  if (error) throw error;
  const side = (data?.booth_accounts as { side?: unknown } | null | undefined)?.side;
  if (!data || !isSide(side)) return null;
  return { id: data.id, name: data.name, side };
}

/** Menjadikan perangkat ini bilik untuk akun tersebut; perangkat lama akun itu dinonaktifkan. */
export async function registerThisDevice(account: BoothAccount): Promise<{ id: string; name: string }> {
  const supabase = db();
  // Indeks unik booths_one_active_per_account menolak dua bilik aktif untuk satu akun;
  // jika aktivasi lain menyela di antara cabut dan insert, ulangi sekali.
  let data: { id: string; name: string } | null = null;
  for (let attempt = 0; !data; attempt++) {
    const { error: revokeError } = await supabase.from("booths").update({ active: false }).eq("account_id", account.id).eq("active", true);
    if (revokeError) throw revokeError;

    const result = await supabase
      .from("booths")
      .insert({ name: account.name, account_id: account.id })
      .select("id, name")
      .single();
    if (result.error?.code === "23505" && attempt === 0) continue;
    if (result.error) throw result.error;
    data = result.data;
  }

  const expiry = boothExpiry();
  const expires = String(expiry);
  (await cookies()).set(BOOTH_COOKIE, `${data.id}.${expires}.${boothMac(data.id, expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, expiry - Math.floor(Date.now() / 1000)),
  });
  return data;
}

export const DEMO_TRIAL_ONLY = "Bilik demo hanya menerima token kelas Uji Coba.";

export const ONLINE_TEACHER_ONLY = "Tautan ini hanya untuk token guru. Siswa memilih di bilik yang disediakan panitia.";

export const NOT_A_BOOTH ="Perangkat ini bukan bilik pemilihan resmi. Silakan memilih di bilik yang disediakan panitia.";
