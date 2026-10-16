import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { MASTER_ONLY, adminRoute, fail, readJson } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { BOOTH_PASSWORD_MIN, BOOTH_USERNAME_PATTERN, boothUsername } from "@/lib/booth-username";
import { isSide } from "@/lib/sides";

const UUID = /^[0-9a-f-]{36}$/;

function checkPassword(input: unknown): string | null {
  const password = typeof input === "string" ? input.trim() : "";
  return password.length >= BOOTH_PASSWORD_MIN && password.length <= 64 ? password : null;
}

// Mengelola akun bilik: buat, ganti password, hapus. Username dan password
// ditentukan panitia; database hanya menyimpan hash password.
export async function POST(req: Request) {
  return adminRoute(MASTER_ONLY, async () => {
    const body = await readJson(req);
    const supabase = db();

    if (body?.action === "create") {
      const username = boothUsername(typeof body.username === "string" ? body.username : "");
      if (!BOOTH_USERNAME_PATTERN.test(username)) {
        return fail(400, "Username 3–30 karakter: huruf kecil, angka, - atau _ (mis. bilik1).");
      }
      const password = checkPassword(body.password);
      if (!password) return fail(400, `Password minimal ${BOOTH_PASSWORD_MIN} karakter.`);
      if (!isSide(body.side)) return fail(400, "Pilih sisi bilik: putra atau putri.");

      const { data, error } = await supabase
        .from("booth_accounts")
        .insert({ name: username, password_hash: await hashPassword(password), side: body.side })
        .select("id, name, side")
        .single();
      if (error?.code === "23505") return fail(400, `Username "${username}" sudah dipakai.`);
      if (error) throw error;
      return NextResponse.json({ account: data });
    }

    const id = body?.id;
    if (typeof id !== "string" || !UUID.test(id)) return fail(400, "Permintaan tidak valid.");

    if (body?.action === "password") {
      const password = checkPassword(body.password);
      if (!password) return fail(400, `Password minimal ${BOOTH_PASSWORD_MIN} karakter.`);
      const { data, error } = await supabase
        .from("booth_accounts")
        .update({ password_hash: await hashPassword(password) })
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return fail(404, "Akun bilik tidak ditemukan.");
      // Password lama dianggap tidak berlaku lagi: laptop yang memakai akun ini ikut dicabut.
      const { error: revokeError } = await supabase.from("booths").update({ active: false }).eq("account_id", id).eq("active", true);
      if (revokeError) throw revokeError;
      return NextResponse.json({ ok: true });
    }

    if (body?.action === "delete") {
      // Riwayat perangkat bilik akun ini ikut terhapus (on delete cascade).
      const { error } = await supabase.from("booth_accounts").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return fail(400, "Permintaan tidak valid.");
  });
}
