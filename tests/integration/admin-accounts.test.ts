import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { adminCookie, call, db } from "./helpers.ts";

let master: string, putra: string;
let hadPutri = false;

before(async () => {
  master = await adminCookie("MASTER");
  putra = await adminCookie("PUTRA");
  hadPutri = !!(await db.from("admin_accounts").select("id").eq("role", "PUTRI").maybeSingle()).data;
});

after(async () => {
  if (!hadPutri) await db.from("admin_accounts").delete().eq("role", "PUTRI");
});

test("admin sisi tidak bisa mengatur akun panitia", async () => {
  const res = await call("/api/admin/admin-accounts", { cookie: putra, body: { role: "PUTRI", username: "zztest-putri", password: "abcdef" } });
  assert.equal(res.status, 403);
});

test("username master tidak boleh dipakai", async () => {
  const res = await call("/api/admin/admin-accounts", {
    cookie: master,
    body: { role: "PUTRI", username: process.env.ADMIN_USERNAME, password: "abcdef" },
  });
  assert.equal(res.status, 400);
});

test("master membuat akun putri; ganti password mengeluarkan perangkatnya", async (t) => {
  if (hadPutri) return t.skip("akun putri lokal sudah ada; tes ini tidak menimpanya");
  const set = await call("/api/admin/admin-accounts", { cookie: master, body: { role: "PUTRI", username: "zztest-putri", password: "rahasia1" } });
  assert.equal(set.status, 200);

  const login = await call("/api/admin/login", { body: { username: "zztest-putri", password: "rahasia1" } });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await call("/api/admin/overview", { cookie })).json.role, "PUTRI");

  const change = await call("/api/admin/admin-accounts", { cookie: master, body: { role: "PUTRI", username: "zztest-putri", password: "rahasia2" } });
  assert.equal(change.status, 200);
  assert.equal((await call("/api/admin/overview", { cookie })).status, 401);
  assert.equal((await call("/api/admin/login", { body: { username: "zztest-putri", password: "rahasia1" } })).status, 401);
});
