import type { Category } from "./categories";
import type { Side } from "./sides";

// Nama kelas menentukan sisi; tingkat menentukan SMP (7–9) atau SMA (10–12).
const HOUSES = {
  Cambridge: "PUTRI",
  Harvard: "PUTRI",
  Stanford: "PUTRA",
  MIT: "PUTRA",
  Oxford: "PUTRA",
} as const;

type House = keyof typeof HOUSES;

// Kelas yang benar-benar ada tahun ajaran ini (daftar siswa sekolah).
// Stanford hanya ada di tingkat 10 dan 11.
const FOUR: House[] = ["Cambridge", "Harvard", "MIT", "Oxford"];
const FIVE: House[] = ["Cambridge", "Harvard", "Stanford", "MIT", "Oxford"];
const HOUSES_BY_GRADE: Record<number, House[]> = { 7: FOUR, 8: FOUR, 9: FOUR, 10: FIVE, 11: FIVE, 12: FOUR };

/** 26 kelas dalam bentuk baku, mis. "12 MIT", urut per tingkat. */
export const CLASS_NAMES: string[] = Object.entries(HOUSES_BY_GRADE).flatMap(([grade, houses]) => houses.map((house) => `${grade} ${house}`));

// Kelas khusus uji coba, satu per kategori. Tokennya dihapus oleh "Hapus data uji coba".
export const TRIAL_CLASSES: Record<string, Category> = {
  "Uji Coba SMP Putra": "SMP_PUTRA",
  "Uji Coba SMA Putra": "SMA_PUTRA",
  "Uji Coba SMP Putri": "SMP_PUTRI",
  "Uji Coba SMA Putri": "SMA_PUTRI",
};
export const TRIAL_CLASS_NAMES = Object.keys(TRIAL_CLASSES);

// Guru memilih ketua SMP dan SMA di sisinya, jadi tiap guru punya satu token di
// masing-masing kelas guru sisinya. Suaranya dihitung sama dengan suara siswa.
export const TEACHER_CLASSES: Record<string, Category> = {
  "Guru SMP Putra": "SMP_PUTRA",
  "Guru SMA Putra": "SMA_PUTRA",
  "Guru SMP Putri": "SMP_PUTRI",
  "Guru SMA Putri": "SMA_PUTRI",
};
export const TEACHER_CLASS_NAMES = Object.keys(TEACHER_CLASSES);

/** Kelas guru satu sisi, mis. PUTRA → ["Guru SMP Putra", "Guru SMA Putra"]. */
export function teacherClassesOf(side: Side): string[] {
  return TEACHER_CLASS_NAMES.filter((c) => TEACHER_CLASSES[c].endsWith(`_${side}`));
}

// Staf hanya memilih ketua SMA di sisinya. Tokennya tanpa nama, diberi nomor "No. 01", "No. 02", …
// agar slip tercetak urut dan pembuatan ulang tidak menambah token ganda.
export const STAFF_CLASSES: Record<string, Category> = {
  "Staf SMA Putra": "SMA_PUTRA",
  "Staf SMA Putri": "SMA_PUTRI",
};
export const STAFF_CLASS_NAMES = Object.keys(STAFF_CLASSES);

/** Kelas staf satu sisi, mis. PUTRA → ["Staf SMA Putra"]. */
export function staffClassesOf(side: Side): string[] {
  return STAFF_CLASS_NAMES.filter((c) => STAFF_CLASSES[c].endsWith(`_${side}`));
}

/** Nama token staf: "No. 01" … "No. n". */
export function staffNumbers(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `No. ${String(i + 1).padStart(2, "0")}`);
}

const SPECIAL_CLASSES: Record<string, Category> = { ...TEACHER_CLASSES, ...STAFF_CLASSES, ...TRIAL_CLASSES };

const PATTERN = /^(7|8|9|10|11|12)\s*([a-z]+)$/i;

/** "12mit", "12 Mit" → "12 MIT". Null jika bukan kelas di CLASS_NAMES, TEACHER_CLASS_NAMES, STAFF_CLASS_NAMES, atau TRIAL_CLASS_NAMES. */
export function normalizeClassName(input: string): string | null {
  const spaced = input.replace(/\s+/g, " ").trim().toLowerCase();
  const special = Object.keys(SPECIAL_CLASSES).find((c) => c.toLowerCase() === spaced);
  if (special) return special;
  const match = input.trim().match(PATTERN);
  if (!match) return null;
  const house = HOUSES_BY_GRADE[Number(match[1])].find((h) => h.toLowerCase() === match[2].toLowerCase());
  return house ? `${match[1]} ${house}` : null;
}

export function categoryOfClass(input: string): Category | null {
  const name = normalizeClassName(input);
  if (!name) return null;
  if (name in SPECIAL_CLASSES) return SPECIAL_CLASSES[name];
  const [grade, house] = name.split(" ") as [string, House];
  const level = Number(grade) <= 9 ? "SMP" : "SMA";
  return `${level}_${HOUSES[house]}` as Category;
}
