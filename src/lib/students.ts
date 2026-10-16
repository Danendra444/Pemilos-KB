import { normalizeClassName } from "./classes.ts";

export const STUDENT_NAME_MAX = 80;
/** Nama lebih panjang dari ini dipendekkan agar muat satu baris di slip token. */
export const STUDENT_NAME_SHORT = 25;
export const MAX_STUDENTS_PER_REQUEST = 200;
export const MAX_SCHOOL_IMPORT = 2000;

/**
 * Rapikan spasi, lalu hapus kata dari belakang sampai panjangnya ≤25 karakter
 * (kata pertama selalu dipertahankan). Mengembalikan null jika kosong atau terlalu panjang.
 */
export function normalizeStudentName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const words = input.replace(/\s+/g, " ").trim().split(" ");
  while (words.length > 1 && words.join(" ").length > STUDENT_NAME_SHORT) words.pop();
  const name = words.join(" ");
  return name.length >= 1 && name.length <= STUDENT_NAME_MAX ? name : null;
}

/**
 * Membaca daftar nama yang ditempel dari Excel/Sheets: satu siswa per baris.
 * Jika baris berisi beberapa kolom (tab), kolom berisi angka saja (No., NIS)
 * dilewati dan kolom teks pertama dipakai sebagai nama. Nomor urut di depan
 * nama ("1. Ahmad") juga dibuang. Nama ganda (tanpa memedulikan huruf besar)
 * hanya diambil sekali.
 */
export function parseStudentList(text: string): { names: string[]; duplicates: number; invalid: number } {
  const names: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  let invalid = 0;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cell = line
      .split("\t")
      .map((c) => c.trim())
      .find((c) => c && !/^[\d\s.\-/]+$/.test(c));
    const name = normalizeStudentName(cell?.replace(/^\d+\s*[.)]\s*/, ""));
    if (!name) {
      invalid++;
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    names.push(name);
  }

  return { names, duplicates, invalid };
}

export type SchoolRow = { name: string; className: string };

/**
 * Membaca daftar seluruh sekolah yang ditempel dari Excel: satu siswa per baris,
 * kolom dipisah tab. Sel yang cocok dengan salah satu dari 26 kelas dianggap kelas;
 * sel teks pertama lainnya dianggap nama; sel angka saja (No., NIS) dilewati.
 * Baris tanpa kelas yang dikenali atau tanpa nama masuk ke `unknown`.
 */
export function parseSchoolList(text: string): { rows: SchoolRow[]; duplicates: number; unknown: string[] } {
  const rows: SchoolRow[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = line.split("\t").map((c) => c.trim()).filter(Boolean);
    const classCell = cells.find((c) => normalizeClassName(c));
    const nameCell = cells.find((c) => c !== classCell && !/^[\d\s.\-/]+$/.test(c));
    const className = classCell ? normalizeClassName(classCell) : null;
    const name = normalizeStudentName(nameCell?.replace(/^\d+\s*[.)]\s*/, ""));
    if (!className || !name) {
      unknown.push(line);
      continue;
    }
    const key = `${className}|${name.toLowerCase()}`;
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    rows.push({ name, className });
  }

  return { rows, duplicates, unknown };
}
