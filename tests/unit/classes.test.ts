import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASS_NAMES, categoryOfClass, normalizeClassName, staffClassesOf, staffNumbers, teacherClassesOf } from "../../src/lib/classes.ts";

test("26 kelas sesuai daftar sekolah, urut per tingkat", () => {
  assert.equal(CLASS_NAMES.length, 26);
  assert.deepEqual(CLASS_NAMES.slice(0, 4), ["7 Cambridge", "7 Harvard", "7 MIT", "7 Oxford"]);
  assert.deepEqual(
    CLASS_NAMES.filter((c) => c.startsWith("10 ")),
    ["10 Cambridge", "10 Harvard", "10 Stanford", "10 MIT", "10 Oxford"],
  );
  assert.deepEqual(CLASS_NAMES.filter((c) => c.endsWith("Stanford")), ["10 Stanford", "11 Stanford"]);
  assert.equal(CLASS_NAMES[25], "12 Oxford");
});

test("normalizeClassName", () => {
  assert.equal(normalizeClassName("12 MIT"), "12 MIT");
  assert.equal(normalizeClassName("12mit"), "12 MIT");
  assert.equal(normalizeClassName("  8   cambridge "), "8 Cambridge");
  assert.equal(normalizeClassName("10 STANFORD"), "10 Stanford");
  assert.equal(normalizeClassName("7 Stanford"), null);
  assert.equal(normalizeClassName("12 Stanford"), null);
  assert.equal(normalizeClassName("6 MIT"), null);
  assert.equal(normalizeClassName("13 MIT"), null);
  assert.equal(normalizeClassName("XII MIT"), null);
  assert.equal(normalizeClassName("12 Yale"), null);
  assert.equal(normalizeClassName("DEMO"), null);
  assert.equal(normalizeClassName("  uji coba   smp putra "), "Uji Coba SMP Putra");
  assert.equal(normalizeClassName("Uji Coba"), null);
  assert.equal(normalizeClassName(" guru  sma putri"), "Guru SMA Putri");
  assert.equal(normalizeClassName("Guru Putra"), null);
});

test("categoryOfClass", () => {
  assert.equal(categoryOfClass("7 Cambridge"), "SMP_PUTRI");
  assert.equal(categoryOfClass("9 Harvard"), "SMP_PUTRI");
  assert.equal(categoryOfClass("10 Harvard"), "SMA_PUTRI");
  assert.equal(categoryOfClass("9 Oxford"), "SMP_PUTRA");
  assert.equal(categoryOfClass("12 mit"), "SMA_PUTRA");
  assert.equal(categoryOfClass("DEMO"), null);
  assert.equal(categoryOfClass("Uji Coba SMP Putra"), "SMP_PUTRA");
  assert.equal(categoryOfClass("Uji Coba SMA Putra"), "SMA_PUTRA");
  assert.equal(categoryOfClass("uji coba smp putri"), "SMP_PUTRI");
  assert.equal(categoryOfClass("Uji Coba SMA Putri"), "SMA_PUTRI");
});

test("guru memilih SMP dan SMA di sisinya", () => {
  assert.deepEqual(teacherClassesOf("PUTRA"), ["Guru SMP Putra", "Guru SMA Putra"]);
  assert.deepEqual(teacherClassesOf("PUTRI"), ["Guru SMP Putri", "Guru SMA Putri"]);
  assert.equal(categoryOfClass("Guru SMP Putra"), "SMP_PUTRA");
  assert.equal(categoryOfClass("Guru SMA Putra"), "SMA_PUTRA");
  assert.equal(categoryOfClass("Guru SMP Putri"), "SMP_PUTRI");
  assert.equal(categoryOfClass("Guru SMA Putri"), "SMA_PUTRI");
});

test("kelas staf: hanya SMA, token bernomor dua digit", () => {
  assert.deepEqual(staffClassesOf("PUTRA"), ["Staf SMA Putra"]);
  assert.deepEqual(staffClassesOf("PUTRI"), ["Staf SMA Putri"]);
  assert.equal(normalizeClassName(" staf  sma putri"), "Staf SMA Putri");
  assert.equal(normalizeClassName("Staf SMP Putra"), null);
  assert.equal(categoryOfClass("Staf SMA Putra"), "SMA_PUTRA");
  assert.equal(categoryOfClass("Staf SMA Putri"), "SMA_PUTRI");
  assert.deepEqual(staffNumbers(3), ["No. 01", "No. 02", "No. 03"]);
  assert.equal(staffNumbers(10).at(-1), "No. 10");
});
