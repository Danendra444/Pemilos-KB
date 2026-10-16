import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { adminCookie, call, cleanup, db, getSettings, makeToken, setSettings } from "./helpers.ts";

const trialToken = async (className: string) => {
  const res = await call("/api/admin/tokens", { cookie: master, body: { className, names: [`ZZTEST ${Math.random()}`] } });
  assert.equal(res.status, 200);
  const { data } = await db.from("tokens").select("code").eq("class_name", className).order("created_at", { ascending: false }).limit(1).single();
  return data!.code as string;
};
const clearTrialClasses = () => db.from("tokens").delete().like("class_name", "Uji Coba%");

let master: string, putra: string;
let original: Awaited<ReturnType<typeof getSettings>>;
// Token terpakai dan jumlah suara yang sudah ada di database lokal disimpan lalu dipulihkan.
let usedBefore: string[] = [];
let countsBefore: { candidate_id: number; count: number }[] = [];
before(async () => {
  master = await adminCookie("MASTER");
  putra = await adminCookie("PUTRA");
  original = await getSettings();
  usedBefore = (await db.from("tokens").select("code").eq("used", true)).data!.map((t) => t.code);
  countsBefore = (await db.from("vote_counts").select("candidate_id, count")).data!;
  if (usedBefore.length > 0) await db.from("tokens").update({ used: false }).in("code", usedBefore);
});
beforeEach(async () => {
  await cleanup();
  await clearTrialClasses();
  await setSettings({ voting_open_smp_putra: false, voting_open_sma_putra: false, voting_open_smp_putri: false, voting_open_sma_putri: false });
});
after(async () => {
  await setSettings(original);
  await cleanup();
  await clearTrialClasses();
  if (usedBefore.length > 0) await db.from("tokens").update({ used: true }).in("code", usedBefore);
  for (const c of countsBefore) await db.from("vote_counts").update({ count: c.count }).eq("candidate_id", c.candidate_id);
});

const markUsed = async (code: string) => {
  const { error } = await db.from("tokens").update({ used: true }).eq("code", code);
  if (error) throw error;
};
const exists = async (code: string) => (await db.from("tokens").select("code").eq("code", code)).data!.length === 1;

test("hanya master", async () => {
  assert.equal((await call("/api/admin/trial/clear", { cookie: putra, body: {} })).status, 403);
});

test("ditolak saat pemungutan suara terbuka", async () => {
  await setSettings({ voting_open_smp_putri: true, voting_open_sma_putri: true });
  const trial = await trialToken("Uji Coba SMA Putri");
  assert.equal((await call("/api/admin/trial/clear", { cookie: master, body: {} })).status, 409);
  assert.ok(await exists(trial));
});

test("ditolak jika token siswa sudah terpakai", async () => {
  const trial = await trialToken("Uji Coba SMA Putra");
  const real = await makeToken("SMA_PUTRA", "ZZTEST Siswa");
  await markUsed(real);
  const res = await call("/api/admin/trial/clear", { cookie: master, body: {} });
  assert.equal(res.status, 409);
  assert.ok(await exists(trial));
});

test("menghapus token kelas uji coba, menolkan suara, token siswa tetap", async () => {
  const usedTrial = await trialToken("Uji Coba SMA Putra");
  const unusedTrial = await trialToken("Uji Coba SMP Putri");
  const real = await makeToken("SMA_PUTRA", "ZZTEST Siswa");
  const anonymous = await makeToken("SMP_PUTRA");
  await markUsed(usedTrial);
  const { data: candidate } = await db.from("candidates").select("id").limit(1).single();
  await db.from("vote_counts").update({ count: 3 }).eq("candidate_id", candidate!.id);
  await setSettings({ results_published: true });

  const res = await call("/api/admin/trial/clear", { cookie: master, body: {} });
  assert.equal(res.status, 200);
  assert.equal(res.json.deleted, 2);
  assert.ok(!(await exists(usedTrial)));
  assert.ok(!(await exists(unusedTrial)));
  assert.ok(await exists(real));
  assert.ok(await exists(anonymous));
  const { data: counts } = await db.from("vote_counts").select("count");
  assert.ok(counts!.every((c) => c.count === 0));
  assert.equal((await getSettings()).results_published, false);
});
