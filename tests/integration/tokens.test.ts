import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { adminCookie, call, cleanup, db, makeToken } from "./helpers.ts";

let master: string, putra: string;
before(async () => {
  master = await adminCookie("MASTER");
  putra = await adminCookie("PUTRA");
});
after(cleanup);

test("master membuat token per kelas; kategori dari nama kelas", async () => {
  const first = await call("/api/admin/tokens", { cookie: master, body: { className: "12 mit", names: ["ZZTEST Ahmad", "ZZTEST Budi"] } });
  assert.equal(first.status, 200);
  assert.deepEqual(first.json, { created: 2, skipped: 0 });
  const { data } = await db.from("tokens").select("class_name, category").like("student_name", "ZZTEST%");
  assert.ok(data!.every((t) => t.class_name === "12 MIT" && t.category === "SMA_PUTRA"));

  const again = await call("/api/admin/tokens", { cookie: master, body: { className: "12 MIT", names: ["zztest ahmad"] } });
  assert.deepEqual(again.json, { created: 0, skipped: 1 });
});

test("kelas tidak dikenal ditolak", async () => {
  const res = await call("/api/admin/tokens", { cookie: master, body: { className: "DEMO", names: ["ZZTEST X"] } });
  assert.equal(res.status, 400);
});

test("impor seluruh sekolah", async () => {
  const res = await call("/api/admin/tokens", {
    cookie: master,
    body: { students: [{ name: "ZZTEST Siti", className: "8 cambridge" }, { name: "ZZTEST Dewi", className: "10 Harvard" }] },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json.created, 2);
  const { data } = await db.from("tokens").select("class_name, category").in("student_name", ["ZZTEST Siti", "ZZTEST Dewi"]).order("class_name");
  assert.deepEqual(data, [
    { class_name: "10 Harvard", category: "SMA_PUTRI" },
    { class_name: "8 Cambridge", category: "SMP_PUTRI" },
  ]);
});

test("admin putra: daftar, ganti, cetak hanya kategori putra", async () => {
  const own = await makeToken("SMA_PUTRA", "ZZTEST Putra");
  const other = await makeToken("SMA_PUTRI", "ZZTEST Putri");

  assert.equal((await call("/api/admin/tokens/list?kelas=ZZTEST&kategori=SMA_PUTRA", { cookie: putra })).status, 200);
  assert.equal((await call("/api/admin/tokens/list?kelas=ZZTEST&kategori=SMA_PUTRI", { cookie: putra })).status, 404);

  assert.equal((await call("/api/admin/tokens/replace", { cookie: putra, body: { code: other } })).status, 404);
  assert.equal((await call("/api/admin/tokens/replace", { cookie: putra, body: { code: own } })).status, 200);

  assert.equal((await call("/osisgod/cetak?kelas=ZZTEST&kategori=SMA_PUTRA", { cookie: putra })).status, 200);
  assert.equal((await call("/osisgod/cetak?kelas=ZZTEST&kategori=SMA_PUTRI", { cookie: putra })).status, 404);
  assert.equal((await call("/osisgod/cetak?kelas=ZZTEST", { cookie: putra })).status, 404);
});
