import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { adminRoute, fail, MASTER_ONLY, readJson } from "@/lib/http";
import { endSessionsFor, masterUsername } from "@/lib/admin-auth";
import { hashPassword } from "@/lib/password";
import { BOOTH_PASSWORD_MIN, BOOTH_USERNAME_PATTERN, boothUsername } from "@/lib/booth-username";
import { isSide } from "@/lib/sides";

// Master membuat atau mengganti login panitia putra/putri (satu akun per sisi).
export async function POST(req: Request) {
  return adminRoute(MASTER_ONLY, async () => {
    const body = await readJson(req);
    const role = body?.role;
    if (!isSide(role)) return fail(400, "Permintaan tidak valid.");

    const username = boothUsername(typeof body?.username === "string" ? body.username : "");
    if (!BOOTH_USERNAME_PATTERN.test(username)) return fail(400, "Username 3–30 karakter: huruf kecil, angka, - atau _.");
    if (username === masterUsername()) return fail(400, "Username ini dipakai akun master.");

    const password = typeof body?.password === "string" ? body.password.trim() : "";
    if (password.length < BOOTH_PASSWORD_MIN || password.length > 64) return fail(400, `Password ${BOOTH_PASSWORD_MIN}–64 karakter.`);

    const { error } = await db()
      .from("admin_accounts")
      .upsert({ role, username, password_hash: await hashPassword(password) }, { onConflict: "role" });
    if (error?.code === "23505") return fail(400, `Username "${username}" sudah dipakai.`);
    if (error) throw error;

    // Password lama tidak berlaku lagi: perangkat yang sedang login dengan akun ini dikeluarkan.
    await endSessionsFor(role);
    return NextResponse.json({ ok: true });
  });
}
