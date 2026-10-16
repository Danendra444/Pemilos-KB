import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { generateToken } from "@/lib/token";
import { adminRoute, fail, MASTER_ONLY, readJson } from "@/lib/http";
import { categoryOfClass, normalizeClassName } from "@/lib/classes";
import { MAX_SCHOOL_IMPORT, MAX_STUDENTS_PER_REQUEST, normalizeStudentName } from "@/lib/students";

type NewToken = { category: string; class_name: string; student_name: string };

// Hanya master. Dua cara: { className, names } untuk satu kelas, atau
// { students: [{ name, className }] } untuk seluruh sekolah.
// Kategori selalu dihitung dari nama kelas.
export async function POST(req: Request) {
  return adminRoute(MASTER_ONLY, async () => {
    const body = await readJson(req);

    let entries: { name: unknown; className: unknown }[];
    if (Array.isArray(body?.students)) {
      if (body.students.length > MAX_SCHOOL_IMPORT) return fail(400, `Maksimal ${MAX_SCHOOL_IMPORT} siswa sekali impor.`);
      entries = body.students.map((s: { name?: unknown; className?: unknown } | null) => ({ name: s?.name, className: s?.className }));
    } else if (Array.isArray(body?.names)) {
      if (body.names.length > MAX_STUDENTS_PER_REQUEST) return fail(400, `Maksimal ${MAX_STUDENTS_PER_REQUEST} siswa sekali impor.`);
      entries = body.names.map((name: unknown) => ({ name, className: body.className }));
    } else {
      entries = [];
    }
    if (entries.length === 0) return fail(400, "Daftar siswa kosong.");

    const rows: NewToken[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
      const className = typeof entry.className === "string" ? normalizeClassName(entry.className) : null;
      if (!className) return fail(400, `Kelas "${String(entry.className ?? "")}" tidak dikenal.`);
      const name = normalizeStudentName(entry.name);
      if (!name) return fail(400, "Ada nama siswa yang kosong atau lebih dari 80 karakter.");
      const key = `${className}|${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ category: categoryOfClass(className)!, class_name: className, student_name: name });
    }

    // Siswa yang sudah punya token di kelasnya dilewati, jadi impor ulang aman.
    const taken = await existingStudents([...new Set(rows.map((r) => r.class_name))]);
    const fresh = rows.filter((r) => !taken.has(`${r.class_name}|${r.student_name.toLowerCase()}`));

    const created = await insertTokens(fresh);
    if (created === null) return fail(409, "Sebagian siswa baru saja didaftarkan. Muat ulang lalu coba lagi.");
    return NextResponse.json({ created, skipped: rows.length - fresh.length });
  });
}

/** Kunci "kelas|nama" siswa yang sudah punya token. Dibaca per halaman: PostgREST membatasi 1000 baris per permintaan. */
async function existingStudents(classes: string[]): Promise<Set<string>> {
  const PAGE = 1000;
  const taken = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db()
      .from("tokens")
      .select("class_name, student_name")
      .in("class_name", classes)
      .not("student_name", "is", null)
      .order("code")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    for (const t of data) taken.add(`${t.class_name}|${(t.student_name as string).toLowerCase()}`);
    if (data.length < PAGE) return taken;
  }
}

/** Kode acak bisa bentrok; baris yang belum masuk diulang dengan kode baru. Null jika nama siswa bentrok. */
async function insertTokens(rows: NewToken[]): Promise<number | null> {
  let created = 0;
  for (let start = 0; start < rows.length; start += 500) {
    let pending = rows.slice(start, start + 500);
    for (let attempt = 0; attempt < 10 && pending.length > 0; attempt++) {
      // Kode dalam satu kiriman dibuat unik; kode kembar akan membuat satu siswa terlewat.
      const codes = new Set<string>();
      while (codes.size < pending.length) codes.add(generateToken());
      const codeList = [...codes];
      const batch = pending.map((r, i) => ({ ...r, code: codeList[i] }));
      const { data, error } = await db().from("tokens").upsert(batch, { onConflict: "code", ignoreDuplicates: true }).select("code");
      if (error?.code === "23505") return null;
      if (error) throw error;
      created += data.length;
      const inserted = new Set(data.map((t) => t.code));
      pending = batch
        .filter((r) => !inserted.has(r.code))
        .map((r) => ({ category: r.category, class_name: r.class_name, student_name: r.student_name }));
    }
  }
  return created;
}
