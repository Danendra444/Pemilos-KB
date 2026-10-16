"use client";

import { useState } from "react";
import { CATEGORY_LABEL } from "@/lib/categories";
import {
  CLASS_NAMES,
  STAFF_CLASS_NAMES,
  TEACHER_CLASS_NAMES,
  TRIAL_CLASS_NAMES,
  categoryOfClass,
  staffClassesOf,
  staffNumbers,
  teacherClassesOf,
} from "@/lib/classes";
import { SIDE_LABEL, SIDES, isSide } from "@/lib/sides";
import { MAX_SCHOOL_IMPORT, MAX_STUDENTS_PER_REQUEST, parseSchoolList, parseStudentList, type SchoolRow } from "@/lib/students";
import { api, Card, inputClass, Message, primaryButton, secondaryButton, type Msg } from "./shared";

const MAX_STAFF = 99;

/** Jumlah siswa per kelas, urut sesuai daftar kelas. */
function groupByClass(rows: SchoolRow[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.className, (counts.get(r.className) ?? 0) + 1);
  return [...CLASS_NAMES, ...TEACHER_CLASS_NAMES, ...STAFF_CLASS_NAMES, ...TRIAL_CLASS_NAMES].filter((c) => counts.has(c)).map((c) => [c, counts.get(c)!]);
}

export function GenerateTokens({ onDone, onClose, className }: { onDone: () => void; onClose?: () => void; className?: string }) {
  const [mode, setMode] = useState<"class" | "school">("class");
  const [kelas, setKelas] = useState("");
  const [list, setList] = useState("");
  const [staffCount, setStaffCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg>(null);

  const single = parseStudentList(list);
  const school = parseSchoolList(list);
  // "PUTRA"/"PUTRI" di pilihan kelas berarti guru sisi itu: satu token di tiap kelas guru sisinya.
  // "STAF_PUTRA"/"STAF_PUTRI" berarti staf sisi itu: tanpa nama, bernomor "No. 01" dst.
  const staffSide = kelas.startsWith("STAF_") ? kelas.slice(5) : null;
  const staffClasses = isSide(staffSide) ? staffClassesOf(staffSide) : null;
  const pairedClasses = isSide(kelas) ? teacherClassesOf(kelas) : staffClasses;
  // Nomor dua digit agar slip tercetak urut; lebih dari 99 akan salah urut.
  const staffTotal = /^\d+$/.test(staffCount) ? Number(staffCount) : 0;
  const staffNames = staffClasses && staffTotal <= MAX_STAFF ? staffNumbers(staffTotal) : [];
  const names = staffClasses ? staffNames : single.names;
  const person = staffClasses ? "staf" : pairedClasses ? "guru" : "siswa";
  const count = mode === "class" ? names.length : school.rows.length;
  const tokenCount = pairedClasses ? count * pairedClasses.length : count;
  const max = mode === "class" ? MAX_STUDENTS_PER_REQUEST : MAX_SCHOOL_IMPORT;
  const ready = count > 0 && count <= max && (mode === "school" || kelas !== "");
  const perClass = mode === "school" ? groupByClass(school.rows) : [];
  const category = kelas && !pairedClasses ? categoryOfClass(kelas) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const body =
        mode === "school"
          ? { students: school.rows }
          : pairedClasses
            ? { students: names.flatMap((name) => pairedClasses.map((className) => ({ name, className }))) }
            : { className: kelas, names: single.names };
      const data = await api("/api/admin/tokens", body);
      const skipped = data.skipped > 0 ? ` ${data.skipped} token sudah ada dan dilewati.` : "";
      setMessage({ ok: true, text: `${data.created} token dibuat.${skipped}` });
      setList("");
      onDone();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    }
    setBusy(false);
  }

  let hint: string;
  if (staffClasses) {
    hint =
      staffTotal > MAX_STAFF
        ? `Maksimal ${MAX_STAFF} staf per sisi.`
        : staffNames.length > 0
          ? `${staffNames[0]} sampai ${staffNames.at(-1)}. Nomor yang sudah ada dilewati.`
          : "Isi jumlah staf.";
  } else if (mode === "class") {
    hint =
      single.names.length === 0
        ? "Satu nama per baris."
        : `${single.names.length} nama terbaca${pairedClasses ? ` · 2 token per guru` : ""}${single.duplicates > 0 ? ` · ${single.duplicates} nama ganda dilewati` : ""}${
            single.invalid > 0 ? ` · ${single.invalid} baris tidak terbaca` : ""
          }`;
  } else {
    hint =
      school.rows.length === 0 && school.unknown.length === 0
        ? "Satu siswa per baris, dengan kolom nama dan kelas."
        : `${school.rows.length} siswa di ${perClass.length} kelas${school.duplicates > 0 ? ` · ${school.duplicates} nama ganda dilewati` : ""}`;
  }
  if (count > max) hint = `${count} ${person}. Maksimal ${max} sekali impor.`;

  const modes = [
    ["class", "Per kelas"],
    ["school", "Seluruh sekolah"],
  ] as const;

  return (
    <Card
      title="Tambah token"
      description="Kategori mengikuti nama kelas. Siswa yang sudah punya token dilewati."
      action={
        onClose && (
          <button type="button" onClick={onClose} className={secondaryButton}>
            Tutup
          </button>
        )
      }
      className={className}
    >
      <div className="mb-4 grid grid-cols-2 rounded-lg border border-line bg-paper p-1" role="group" aria-label="Cara membuat token">
        {modes.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setMode(key);
              setMessage(null);
            }}
            aria-pressed={mode === key}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === "class" && (
          <div>
            <label htmlFor="kelas" className="text-sm font-semibold">
              Kelas
            </label>
            <select id="kelas" value={kelas} onChange={(e) => setKelas(e.target.value)} className={`${inputClass} pr-10`} required>
              <option value="" disabled>
                Pilih…
              </option>
              {CLASS_NAMES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <optgroup label="Guru">
                {SIDES.map((side) => (
                  <option key={side} value={side}>
                    Guru {SIDE_LABEL[side]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Staf">
                {SIDES.map((side) => (
                  <option key={side} value={`STAF_${side}`}>
                    Staf {SIDE_LABEL[side]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Uji coba">
                {TRIAL_CLASS_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            </select>
            {category && <p className="mt-1 text-sm text-muted">{CATEGORY_LABEL[category]}</p>}
            {pairedClasses && (
              <p className="mt-1 text-sm text-muted">
                Tiap {person} mendapat token {pairedClasses.map((c) => CATEGORY_LABEL[categoryOfClass(c)!]).join(" dan ")}.
              </p>
            )}
          </div>
        )}
        {staffClasses ? (
          <div>
            <label htmlFor="jumlah-staf" className="text-sm font-semibold">
              Jumlah staf
            </label>
            <input
              id="jumlah-staf"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_STAFF}
              value={staffCount}
              onChange={(e) => setStaffCount(e.target.value)}
              className={inputClass}
            />
            <p className={`mt-1 text-sm ${staffTotal > MAX_STAFF ? "text-danger" : "text-muted"}`}>{hint}</p>
          </div>
        ) : (
          <div>
            <label htmlFor="daftar" className="text-sm font-semibold">
              Daftar {person}
            </label>
            <textarea
              id="daftar"
              value={list}
              onChange={(e) => setList(e.target.value)}
              rows={mode === "class" ? 8 : 10}
              spellCheck={false}
              className={`${inputClass} resize-y text-sm leading-relaxed`}
            />
            <p className={`mt-1 text-sm ${count > max ? "text-danger" : "text-muted"}`}>{hint}</p>
          </div>
        )}
        {perClass.length > 0 && (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-paper px-3 py-2 text-sm tabular-nums">
            {perClass.map(([c, n]) => (
              <li key={c} className="flex justify-between gap-2">
                <span>{c}</span>
                <span className="text-muted">{n}</span>
              </li>
            ))}
          </ul>
        )}
        {mode === "school" && school.unknown.length > 0 && (
          <div role="alert" className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
            <p className="font-semibold">{school.unknown.length} baris tidak dikenali kelasnya dan tidak ikut dibuat:</p>
            <ul className="mt-1 space-y-0.5 font-mono text-xs">
              {school.unknown.slice(0, 10).map((line, i) => (
                <li key={i} className="truncate">
                  {line.replace(/\t/g, "  ")}
                </li>
              ))}
            </ul>
            {school.unknown.length > 10 && <p className="mt-1">dan {school.unknown.length - 10} baris lainnya.</p>}
          </div>
        )}
        <button type="submit" disabled={busy || !ready} className={`${primaryButton} w-full py-3`}>
          {busy ? "Membuat…" : ready ? `Buat ${tokenCount} token` : "Buat token"}
        </button>
        <Message message={message} />
      </form>
    </Card>
  );
}
