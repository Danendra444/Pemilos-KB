import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStudentName, parseSchoolList, parseStudentList } from "../../src/lib/students.ts";

test("parseStudentList: buang nomor, NIS, dan nama ganda", () => {
  const result = parseStudentList("1\tAhmad Fauzi\t12345\n2. Budi Santoso\n\nbudi  santoso\n123\n");
  assert.deepEqual(result.names, ["Ahmad Fauzi", "Budi Santoso"]);
  assert.equal(result.duplicates, 1);
  assert.equal(result.invalid, 1);
});

test("parseSchoolList: kolom nama dan kelas dalam urutan apa pun", () => {
  const text = [
    "1\tAhmad Fauzi\t12 MIT",
    "2\t8 cambridge\tSiti Aminah\t20231",
    "3\tBudi\t12mit",
    "4\tahmad  fauzi\t12 MIT",
    "5\tCitra\t13 MIT",
    "6\t12 Oxford",
    "",
  ].join("\n");
  const result = parseSchoolList(text);
  assert.deepEqual(result.rows, [
    { name: "Ahmad Fauzi", className: "12 MIT" },
    { name: "Siti Aminah", className: "8 Cambridge" },
    { name: "Budi", className: "12 MIT" },
  ]);
  assert.equal(result.duplicates, 1);
  assert.deepEqual(result.unknown, ["5\tCitra\t13 MIT", "6\t12 Oxford"]);
});

test("normalizeStudentName: nama >25 karakter dipendekkan per kata dari belakang", () => {
  assert.equal(normalizeStudentName("Andi Bagus Cahya Dwi Eka Fajar"), "Andi Bagus Cahya Dwi Eka");
  assert.equal(normalizeStudentName("Rahmawati Kusuma Ayu Dewi Lestari"), "Rahmawati Kusuma Ayu Dewi");
  // Tepat 25 karakter tidak diubah.
  assert.equal(normalizeStudentName("Rahmawati Kusuma Ayu Dewi"), "Rahmawati Kusuma Ayu Dewi");
  assert.equal(normalizeStudentName("  Ahmad   Fauzi "), "Ahmad Fauzi");
  // Satu kata tidak bisa dipendekkan; dibiarkan utuh.
  assert.equal(normalizeStudentName("Abcdefghijklmnopqrstuvwxyzabc"), "Abcdefghijklmnopqrstuvwxyzabc");
  assert.equal(normalizeStudentName("Abcdefghijklmnopqrstuvwxyzabc Budi"), "Abcdefghijklmnopqrstuvwxyzabc");
  assert.equal(normalizeStudentName("   "), null);
});

test("parseSchoolList memakai nama yang sudah dipendekkan", () => {
  const result = parseSchoolList("1\tBagus Wicaksono Pratama Satria Putra Mandala\t11 MIT");
  assert.deepEqual(result.rows, [{ name: "Bagus Wicaksono Pratama", className: "11 MIT" }]);
});
