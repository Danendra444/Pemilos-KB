import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { adminCookie, call, cleanup, getSettings, makeToken, setSettings } from "./helpers.ts";

let saved: Awaited<ReturnType<typeof getSettings>>;
let master: string, putra: string, putri: string;

before(async () => {
  saved = await getSettings();
  master = await adminCookie("MASTER");
  putra = await adminCookie("PUTRA");
  putri = await adminCookie("PUTRI");
  await makeToken("SMA_PUTRA");
  await makeToken("SMP_PUTRI");
});

after(async () => {
  await setSettings(saved);
  await cleanup();
});

const categoriesIn = (rows: { category: string }[] | null) => [...new Set((rows ?? []).map((r) => r.category))].sort();

test("overview hanya berisi sisi sendiri", async () => {
  const p = (await call("/api/admin/overview", { cookie: putra })).json;
  assert.equal(p.role, "PUTRA");
  assert.deepEqual(p.voting.map((s: { category: string }) => s.category), ["SMP_PUTRA", "SMA_PUTRA"]);
  assert.ok(p.classes.every((c: { category: string }) => c.category.endsWith("_PUTRA")));
  assert.equal(p.adminAccounts, null);

  const m = (await call("/api/admin/overview", { cookie: master })).json;
  assert.equal(m.role, "MASTER");
  assert.deepEqual(m.voting.map((s: { category: string }) => s.category), ["SMP_PUTRA", "SMP_PUTRI", "SMA_PUTRA", "SMA_PUTRI"]);
  assert.ok(m.classes.some((c: { category: string }) => c.category === "SMP_PUTRI"));
  assert.ok(Array.isArray(m.adminAccounts));
});

test("hasil: master melihat sisi yang tertutup, admin menunggu pengumuman", async () => {
  await setSettings({ voting_open_smp_putra: false, voting_open_sma_putra: false, voting_open_smp_putri: true, voting_open_sma_putri: true, results_published: false });
  assert.deepEqual(categoriesIn((await call("/api/admin/overview", { cookie: master })).json.results), ["SMA_PUTRA", "SMP_PUTRA"]);
  assert.equal((await call("/api/admin/overview", { cookie: putra })).json.results, null);

  assert.equal((await call("/api/admin/results/publish", { cookie: master, body: {} })).status, 409);
  assert.equal((await call("/api/admin/voting", { cookie: putri, body: { category: "SMP_PUTRI", open: false } })).status, 200);
  assert.equal((await call("/api/admin/results/publish", { cookie: master, body: {} })).status, 409);
  assert.equal((await call("/api/admin/voting", { cookie: putri, body: { category: "SMA_PUTRI", open: false } })).status, 200);
  assert.equal((await call("/api/admin/results/publish", { cookie: putra, body: {} })).status, 403);
  assert.equal((await call("/api/admin/results/publish", { cookie: master, body: {} })).status, 200);

  assert.deepEqual(categoriesIn((await call("/api/admin/overview", { cookie: putra })).json.results), ["SMA_PUTRA", "SMP_PUTRA"]);
  assert.deepEqual(categoriesIn((await call("/api/admin/overview", { cookie: putri })).json.results), ["SMA_PUTRI", "SMP_PUTRI"]);
});

test("hari SMP: hasil SMA terlihat oleh master, hasil SMP tidak", async () => {
  await setSettings({ voting_open_smp_putra: true, voting_open_sma_putra: false, voting_open_smp_putri: true, voting_open_sma_putri: false });
  assert.deepEqual(categoriesIn((await call("/api/admin/overview", { cookie: master })).json.results), ["SMA_PUTRA", "SMA_PUTRI"]);
});

test("membuka lagi sebuah kategori membatalkan pengumuman", async () => {
  await setSettings({ voting_open_smp_putra: false, voting_open_sma_putra: false, voting_open_smp_putri: false, voting_open_sma_putri: false, results_published: true });
  assert.equal((await call("/api/admin/voting", { cookie: putra, body: { category: "SMP_PUTRA", open: true } })).status, 200);
  const s = await getSettings();
  assert.equal(s.voting_open_smp_putra, true);
  assert.equal(s.voting_open_sma_putra, false);
  assert.equal(s.results_published, false);
});

test("admin tidak bisa membuka/menutup kategori sisi lain", async () => {
  assert.equal((await call("/api/admin/voting", { cookie: putra, body: { category: "SMP_PUTRI", open: true } })).status, 404);
  assert.equal((await getSettings()).voting_open_smp_putri, false);
  assert.equal((await call("/api/admin/voting", { cookie: putra, body: { side: "PUTRA", open: true } })).status, 400);
});

test("route khusus master menolak admin sisi", async () => {
  for (const [path, body] of [
    ["/api/admin/tokens", { className: "12 MIT", names: ["ZZTEST X"] }],
    ["/api/admin/tokens/delete", { code: "AAAAAA" }],
    ["/api/admin/reset", { confirm: "RESET" }],
    ["/api/admin/booth-accounts", { action: "create", username: "zzx", password: "abcdef", side: "PUTRA" }],
  ] as const) {
    assert.equal((await call(path, { cookie: putra, body })).status, 403, path);
  }
});
