import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { adminCookie, boothCookie, call, cleanup, db, getSettings, makeToken, setSettings } from "./helpers.ts";

let saved: Awaited<ReturnType<typeof getSettings>>;
let master: string, putra: string;
let boothPutra: string, boothPutri: string;

before(async () => {
  saved = await getSettings();
  master = await adminCookie("MASTER");
  putra = await adminCookie("PUTRA");
  boothPutra = (await boothCookie("PUTRA")).cookie;
  boothPutri = (await boothCookie("PUTRI")).cookie;
  await setSettings({ voting_open_smp_putra: true, voting_open_sma_putra: true, voting_open_smp_putri: false, voting_open_sma_putri: false });
});

after(async () => {
  await setSettings(saved);
  await cleanup();
});

async function candidate(category: string): Promise<number> {
  const { data } = await db.from("candidates").select("id").eq("category", category).order("number").limit(1).single();
  return data!.id;
}

test("bilik putra menolak token putri", async () => {
  const code = await makeToken("SMA_PUTRI");
  const res = await call("/api/token/check", { cookie: boothPutra, body: { token: code } });
  assert.equal(res.status, 403);
  assert.match(res.json.error, /bukan untuk bilik ini/);
});

test("sisi putri tertutup walaupun putra dibuka", async () => {
  const code = await makeToken("SMA_PUTRI");
  const res = await call("/api/token/check", { cookie: boothPutri, body: { token: code } });
  assert.equal(res.status, 403);
  assert.match(res.json.error, /belum dibuka/);
});

test("hari SMP: token SMA ditolak, token SMP diterima", async () => {
  await setSettings({ voting_open_smp_putra: true, voting_open_sma_putra: false });
  const sma = await makeToken("SMA_PUTRA");
  const check = await call("/api/token/check", { cookie: boothPutra, body: { token: sma } });
  assert.equal(check.status, 403);
  assert.match(check.json.error, /SMA Putra belum dibuka/);
  const vote = await call("/api/vote", { cookie: boothPutra, body: { token: sma, candidateId: await candidate("SMA_PUTRA") } });
  assert.equal(vote.status, 403);
  assert.equal((await db.from("tokens").select("used").eq("code", sma).single()).data!.used, false);

  const smp = await makeToken("SMP_PUTRA");
  assert.equal((await call("/api/token/check", { cookie: boothPutra, body: { token: smp } })).status, 200);
  await setSettings({ voting_open_smp_putra: true, voting_open_sma_putra: true });
});

test("token putra di bilik putra diterima", async () => {
  const code = await makeToken("SMA_PUTRA");
  const res = await call("/api/token/check", { cookie: boothPutra, body: { token: code } });
  assert.equal(res.status, 200);
  assert.equal(res.json.category, "SMA_PUTRA");
});

test("suara dari bilik sisi lain tidak dicatat", async () => {
  await setSettings({ voting_open_smp_putri: true, voting_open_sma_putri: true });
  const code = await makeToken("SMA_PUTRI");
  const res = await call("/api/vote", { cookie: boothPutra, body: { token: code, candidateId: await candidate("SMA_PUTRI") } });
  assert.equal(res.status, 403);
  const { data } = await db.from("tokens").select("used").eq("code", code).single();
  assert.equal(data!.used, false);
  await setSettings({ voting_open_smp_putri: false, voting_open_sma_putri: false });
});

test("akun bilik tanpa sisi tidak dianggap bilik", async () => {
  const { cookie } = await boothCookie(null);
  const code = await makeToken("SMA_PUTRA");
  const res = await call("/api/token/check", { cookie, body: { token: code } });
  assert.equal(res.status, 403);
  assert.match(res.json.error, /bukan bilik pemilihan resmi/);
});

test("50 kiriman bersamaan dengan satu token → 1 suara", async () => {
  const code = await makeToken("SMA_PUTRA");
  const candidateId = await candidate("SMA_PUTRA");
  const before = (await db.from("vote_counts").select("count").eq("candidate_id", candidateId).single()).data!.count;
  try {
    const results = await Promise.all(
      Array.from({ length: 50 }, () => call("/api/vote", { cookie: boothPutra, body: { token: code, candidateId } })),
    );
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    const afterCount = (await db.from("vote_counts").select("count").eq("candidate_id", candidateId).single()).data!.count;
    assert.equal(afterCount, before + 1);
  } finally {
    await db.from("vote_counts").update({ count: before }).eq("candidate_id", candidateId);
  }
});

test("token sisi lain di /api/vote tidak membocorkan statusnya", async () => {
  const code = await makeToken("SMA_PUTRI");
  await db.from("tokens").update({ used: true }).eq("code", code);
  const res = await call("/api/vote", { cookie: boothPutra, body: { token: code, candidateId: await candidate("SMA_PUTRA") } });
  assert.equal(res.status, 403);
  assert.match(res.json.error, /bukan untuk bilik ini/);
});

test("akun bilik baru wajib punya sisi", async () => {
  try {
    const noSide = await call("/api/admin/booth-accounts", { cookie: master, body: { action: "create", username: "zztest-a1", password: "abcdef" } });
    assert.equal(noSide.status, 400);
    const created = await call("/api/admin/booth-accounts", {
      cookie: master,
      body: { action: "create", username: "zztest-a1", password: "abcdef", side: "PUTRI" },
    });
    assert.equal(created.status, 200);
  } finally {
    await db.from("booth_accounts").delete().eq("name", "zztest-a1");
  }
});

test("admin putra tidak bisa mencabut bilik putri", async () => {
  const { boothId } = await boothCookie("PUTRI");
  assert.equal((await call("/api/admin/booths/revoke", { cookie: putra, body: { id: boothId } })).status, 404);
  const { data } = await db.from("booths").select("active").eq("id", boothId).single();
  assert.equal(data!.active, true);
});

test("admin putra hanya melihat bilik putra", async () => {
  const res = await call("/api/admin/overview", { cookie: putra });
  assert.ok(res.json.accounts.every((a: { side: string }) => a.side === "PUTRA"));
});
