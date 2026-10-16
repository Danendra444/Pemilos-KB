import { test } from "node:test";
import assert from "node:assert/strict";
import { canManage, isSide, resultCategories, sideOf, visibleCategories, visibleSides } from "../../src/lib/sides.ts";

test("sideOf", () => {
  assert.equal(sideOf("SMP_PUTRA"), "PUTRA");
  assert.equal(sideOf("SMA_PUTRI"), "PUTRI");
  assert.equal(sideOf("LAIN"), null);
});

test("isSide", () => {
  assert.equal(isSide("PUTRA"), true);
  assert.equal(isSide("MASTER"), false);
  assert.equal(isSide(null), false);
});

test("visibleSides dan canManage", () => {
  assert.deepEqual(visibleSides("MASTER"), ["PUTRA", "PUTRI"]);
  assert.deepEqual(visibleSides("PUTRI"), ["PUTRI"]);
  assert.equal(canManage("PUTRA", "SMA_PUTRA"), true);
  assert.equal(canManage("PUTRA", "SMA_PUTRI"), false);
  assert.equal(canManage("MASTER", "SMP_PUTRI"), true);
  assert.equal(canManage("MASTER", "LAIN"), false);
});

const closed = { SMP_PUTRA: false, SMA_PUTRA: false, SMP_PUTRI: false, SMA_PUTRI: false };

test("visibleCategories", () => {
  assert.deepEqual(visibleCategories("PUTRA"), ["SMP_PUTRA", "SMA_PUTRA"]);
  assert.deepEqual(visibleCategories("PUTRI"), ["SMP_PUTRI", "SMA_PUTRI"]);
  assert.deepEqual(visibleCategories("MASTER"), ["SMP_PUTRA", "SMP_PUTRI", "SMA_PUTRA", "SMA_PUTRI"]);
});

test("resultCategories: master melihat kategori yang tertutup", () => {
  // Hari SMP: SMP dibuka, SMA tertutup.
  const smpDay = { ...closed, SMP_PUTRA: true, SMP_PUTRI: true };
  assert.deepEqual(resultCategories("MASTER", smpDay, false), ["SMA_PUTRA", "SMA_PUTRI"]);
  assert.deepEqual(resultCategories("MASTER", closed, false), ["SMP_PUTRA", "SMP_PUTRI", "SMA_PUTRA", "SMA_PUTRI"]);
});

test("resultCategories: admin sisi menunggu pengumuman", () => {
  assert.deepEqual(resultCategories("PUTRA", closed, false), []);
  assert.deepEqual(resultCategories("PUTRA", closed, true), ["SMP_PUTRA", "SMA_PUTRA"]);
  assert.deepEqual(resultCategories("PUTRI", { ...closed, SMA_PUTRI: true }, true), ["SMP_PUTRI"]);
});
