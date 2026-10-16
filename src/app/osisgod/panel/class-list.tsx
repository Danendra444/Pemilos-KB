"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, CATEGORY_LABEL, type Category } from "@/lib/categories";
import { CLASS_NAMES, STAFF_CLASS_NAMES, TEACHER_CLASS_NAMES } from "@/lib/classes";
import type { ClassStat } from "@/lib/admin-types";
import { api, Card, Message, pct, type Msg } from "./shared";
import { useConfirm } from "./confirm";

/** Urut per tingkat lalu nama kelas (sesuai CLASS_NAMES), lalu kelas guru dan staf di bawahnya; kelas lain (uji coba, DEMO) di akhir. */
const CLASS_ORDER = [...CLASS_NAMES, ...TEACHER_CLASS_NAMES, ...STAFF_CLASS_NAMES];
function classOrder(name: string): number {
  const i = CLASS_ORDER.indexOf(name);
  return i === -1 ? CLASS_ORDER.length : i;
}

function sum(items: ClassStat[]) {
  return items.reduce((t, c) => ({ used: t.used + c.used, total: t.total + c.total }), { used: 0, total: 0 });
}

export function ClassList({
  classes,
  canDelete,
  onChange,
  action,
  className,
}: {
  classes: ClassStat[];
  canDelete: boolean;
  onChange: () => void;
  action?: React.ReactNode;
  className?: string;
}) {
  // Nama kelas yang sama bisa ada di beberapa kategori, jadi kuncinya kategori + kelas.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Category | "all">("all");

  // Dikelompokkan per kategori; kelas guru dan staf ikut kategorinya dan tampil di bawah kelas siswa.
  const groups = CATEGORIES.map((cat) => ({ key: cat, label: CATEGORY_LABEL[cat], items: classes.filter((c) => c.category === cat) }))
    .map((g) => ({ ...g, items: g.items.sort((a, b) => classOrder(a.class_name) - classOrder(b.class_name) || a.class_name.localeCompare(b.class_name)) }))
    .filter((g) => g.items.length > 0);
  const shown = groups.filter((g) => filter === "all" || g.key === filter);
  const all = sum(classes);

  return (
    <Card
      id="token"
      title="Token per kelas"
      description={
        canDelete
          ? "Tekan Lihat untuk memeriksa siapa yang sudah memilih, mencetak ulang, mengganti slip yang hilang, atau menghapus token."
          : "Tekan Lihat untuk memeriksa siapa yang sudah memilih, mencetak ulang, atau mengganti slip yang hilang."
      }
      action={action}
      className={className}
    >
      {classes.length === 0 ? (
        <p className="rounded-lg bg-paper px-4 py-3 text-sm text-muted">Belum ada token.</p>
      ) : (
        <>
          {groups.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Saring kategori">
              {[{ key: "all" as const, label: "Semua", t: all }, ...groups.map((g) => ({ key: g.key, label: g.label, t: sum(g.items) }))].map(
                (f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    aria-pressed={filter === f.key}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      filter === f.key ? "border-brand bg-brand text-white" : "border-line bg-white hover:bg-paper"
                    }`}
                  >
                    {f.label} <span className={`tabular-nums ${filter === f.key ? "text-white/80" : "text-muted"}`}>{f.t.total}</span>
                  </button>
                ),
              )}
            </div>
          )}
          <div className="space-y-5">
            {shown.map((g) => {
              const t = sum(g.items);
              return (
                <section key={g.key} aria-labelledby={`grp-${g.key}`}>
                  <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                    <h3 id={`grp-${g.key}`} className="font-semibold">
                      {g.label}
                    </h3>
                    <p className="text-sm text-muted tabular-nums">
                      {g.items.length} kelas · {t.used}/{t.total} memilih ({pct(t.used, t.total)}%)
                    </p>
                  </div>
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {g.items.map((c) => {
                      const key = `${c.category}|${c.class_name}`;
                      const expanded = openKey === key;
                      return (
                        <li key={key}>
                          <div className="flex items-center gap-4 px-4 py-2.5">
                            <p className="min-w-0 flex-1 truncate font-medium">{c.class_name}</p>
                            <div className="hidden w-40 items-center gap-3 sm:flex">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper">
                                <div className="h-full rounded-full bg-brand" style={{ width: `${pct(c.used, c.total)}%` }} />
                              </div>
                              <p className="w-14 text-right text-sm tabular-nums">
                                {c.used}/{c.total}
                              </p>
                            </div>
                            <p className="text-sm tabular-nums sm:hidden">
                              {c.used}/{c.total}
                            </p>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => setOpenKey(expanded ? null : key)}
                                aria-expanded={expanded}
                                className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-paper"
                              >
                                {expanded ? "Tutup" : "Lihat"}
                              </button>
                              <a
                                href={printUrl(c.class_name, c.category)}
                                className="rounded-md px-2 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft"
                              >
                                Cetak
                              </a>
                            </div>
                          </div>
                          {expanded && (
                            <ClassTokens
                              className={c.class_name}
                              category={c.category}
                              used={c.used}
                              total={c.total}
                              canDelete={canDelete}
                              onChange={onChange}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

export function printUrl(className: string, category: string, code?: string) {
  const params = new URLSearchParams({ kelas: className, kategori: category });
  if (code) params.set("kode", code);
  return `/osisgod/cetak?${params}`;
}

export type TokenRow = { code: string; student_name: string | null; used: boolean };

export function ClassTokens({
  className,
  category,
  used,
  total,
  canDelete,
  onChange,
}: {
  className: string;
  category: string;
  used: number;
  total: number;
  canDelete: boolean;
  onChange: () => void;
}) {
  const [tokens, setTokens] = useState<TokenRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "used" | "unused">("all");
  const [search, setSearch] = useState("");
  const [reload, setReload] = useState(0);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [message, setMessage] = useState<Msg>(null);
  const [dialog, ask] = useConfirm();

  // Muat ulang saat jumlah token berubah lewat refresh otomatis, atau setelah token diganti.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ kelas: className, kategori: category });
    api(`/api/admin/tokens/list?${params}`).then(
      (data) => {
        if (!cancelled) setTokens(data.tokens);
      },
      (e) => {
        if (!cancelled) setError((e as Error).message);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [className, category, used, total, reload]);

  async function run(code: string, fn: () => Promise<string>) {
    setBusyCode(code);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await fn() });
      setReload((n) => n + 1);
      onChange();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusyCode(null);
  }

  function replace(t: TokenRow) {
    const who = t.student_name ?? `token ${t.code}`;
    ask({
      title: `Ganti token ${who}?`,
      body: `Slip lama (${t.code}) tidak bisa dipakai lagi, lalu cetak slip baru.`,
      confirmLabel: "Ganti token",
      tone: "default",
      action: () =>
        run(t.code, async () => {
          const data = await api("/api/admin/tokens/replace", { code: t.code });
          return `Token ${who} diganti menjadi ${data.code}. Cetak slip barunya.`;
        }),
    });
  }

  function remove(t: TokenRow) {
    const who = t.student_name ?? `token ${t.code}`;
    ask({
      title: `Hapus token ${who}?`,
      confirmLabel: "Hapus",
      word: "HAPUS",
      body: (
        <>
          Slip <span className="font-mono font-semibold">{t.code}</span> tidak bisa dipakai lagi. Tidak bisa dibatalkan.
        </>
      ),
      action: () =>
        run(t.code, async () => {
          await api("/api/admin/tokens/delete", { code: t.code });
          return `Token ${who} dihapus.`;
        }),
    });
  }

  function removeAll(unused: number, usedCount: number) {
    ask({
      title: `Hapus ${unused} token di ${className}?`,
      confirmLabel: "Hapus",
      word: "HAPUS",
      body: (
        <>
          Semua token <strong>belum terpakai</strong> di {className} ({CATEGORY_LABEL[category as Category] ?? category}) dihapus dan slipnya
          tidak bisa dipakai lagi.{usedCount > 0 && ` ${usedCount} token yang sudah terpakai tetap disimpan.`} Tidak bisa dibatalkan.
        </>
      ),
      action: () =>
        run("*", async () => {
          const data = await api("/api/admin/tokens/delete", { className, category });
          return `${data.deleted} token dihapus.`;
        }),
    });
  }

  if (error) return <p className="border-t border-line px-4 py-3 text-sm text-danger">{error}</p>;
  if (!tokens) return <p className="border-t border-line px-4 py-3 text-sm text-muted">Memuat token…</p>;

  const named = tokens.some((t) => t.student_name);
  const usedCount = tokens.filter((t) => t.used).length;
  const unusedCount = tokens.length - usedCount;
  const query = search.trim().toLowerCase();
  const shown = tokens.filter(
    (t) =>
      (filter === "all" ? true : filter === "used" ? t.used : !t.used) &&
      (!query || t.student_name?.toLowerCase().includes(query) || t.code.toLowerCase().includes(query)),
  );
  const filters = [
    ["all", `Semua (${tokens.length})`],
    ["used", `${named ? "Sudah memilih" : "Terpakai"} (${usedCount})`],
    ["unused", `Belum (${unusedCount})`],
  ] as const;
  const rowButton = "rounded-md px-2 py-1 text-sm font-medium disabled:opacity-60";

  return (
    <div className="border-t border-line bg-paper/60 px-4 py-4">
      {dialog}
      <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Saring token">
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === key ? "border-brand bg-brand text-white" : "border-line bg-white hover:bg-paper"
            }`}
          >
            {label}
          </button>
        ))}
        {named && (
          <label className="flex w-full items-center gap-2 text-sm font-semibold sm:ml-auto sm:w-auto">
            Cari
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-44"
            />
          </label>
        )}
      </div>
      <Message message={message} className="mb-3" />
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{query ? "Tidak ada yang cocok." : "Tidak ada token di sini."}</p>
      ) : named ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {shown.map((t) => (
            <li key={t.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${t.student_name ? "font-medium" : "text-muted"}`}>{t.student_name ?? "Tanpa nama"}</span>
                <span className={`font-mono text-sm tracking-wider text-muted ${t.used ? "line-through" : ""}`}>{t.code}</span>
              </span>
              {t.used ? (
                <span className="text-sm font-medium text-ok">Sudah memilih</span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="mr-1 text-sm text-muted">Belum</span>
                  <a href={printUrl(className, category, t.code)} className={`${rowButton} text-brand hover:bg-brand-soft`}>
                    Cetak
                  </a>
                  <button type="button" onClick={() => replace(t)} disabled={busyCode !== null} className={`${rowButton} hover:bg-paper`}>
                    {busyCode === t.code ? "Memproses…" : "Ganti token"}
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(t)}
                      disabled={busyCode !== null}
                      className={`${rowButton} text-danger hover:bg-danger-soft`}
                    >
                      Hapus
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {shown.map((t) => (
            <li
              key={t.code}
              className={`flex items-center justify-between gap-2 rounded-md border border-line px-3 py-2 ${t.used ? "bg-paper" : "bg-white"}`}
            >
              <span className={`font-mono tracking-wider ${t.used ? "text-muted line-through" : "font-semibold"}`}>{t.code}</span>
              <span className={`text-xs font-medium ${t.used ? "text-ok" : "text-muted"}`}>{t.used ? "Terpakai" : "Belum"}</span>
            </li>
          ))}
        </ul>
      )}
      {canDelete && unusedCount > 0 && (
        <div className="mt-4 border-t border-line pt-3 text-right">
          <button
            type="button"
            onClick={() => removeAll(unusedCount, usedCount)}
            disabled={busyCode !== null}
            className={`${rowButton} text-danger hover:bg-danger-soft`}
          >
            {busyCode === "*" ? "Menghapus…" : `Hapus ${unusedCount} token belum terpakai`}
          </button>
        </div>
      )}
    </div>
  );
}
