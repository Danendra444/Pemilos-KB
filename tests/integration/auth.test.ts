import { after, test } from "node:test";
import assert from "node:assert/strict";
import { adminCookie, call, cleanup, db, hashPassword } from "./helpers.ts";

after(cleanup);

test("tanpa login ditolak", async () => {
  assert.equal((await call("/api/admin/overview")).status, 401);
});

test("cookie format lama ditolak", async () => {
  const old = `osis_admin=${Math.floor(Date.now() / 1000) + 3600}.abcdef`;
  assert.equal((await call("/api/admin/overview", { cookie: old })).status, 401);
});

test("login kedua dengan peran yang sama mengeluarkan perangkat pertama", async () => {
  const first = await adminCookie("MASTER");
  assert.equal((await call("/api/admin/overview", { cookie: first })).status, 200);
  const second = await adminCookie("MASTER");
  assert.equal((await call("/api/admin/overview", { cookie: first })).status, 401);
  assert.equal((await call("/api/admin/overview", { cookie: second })).status, 200);
});

test("keluar menonaktifkan sesi", async () => {
  const cookie = await adminCookie("PUTRI");
  await call("/api/admin/logout", { cookie, body: {} });
  assert.equal((await call("/api/admin/overview", { cookie })).status, 401);
});

test("login akun panitia putra", async (t) => {
  const existing = await db.from("admin_accounts").select("id").eq("role", "PUTRA").maybeSingle();
  if (existing.data) return t.skip("akun putra lokal sudah ada; tes ini tidak menimpanya");
  const inserted = await db.from("admin_accounts").insert({ role: "PUTRA", username: "zztest-putra", password_hash: hashPassword("rahasia123") });
  assert.equal(inserted.error, null);
  try {
    const wrong = await call("/api/admin/login", { body: { username: "zztest-putra", password: "salah" } });
    assert.equal(wrong.status, 401);
    const res = await call("/api/admin/login", { body: { username: " ZZTEST-Putra ", password: "rahasia123" } });
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    assert.equal((await call("/api/admin/overview", { cookie })).status, 200);
  } finally {
    await db.from("admin_accounts").delete().eq("username", "zztest-putra");
  }
});
