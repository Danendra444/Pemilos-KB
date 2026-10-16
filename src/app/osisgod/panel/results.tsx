"use client";

import { CATEGORY_LABEL, type Category } from "@/lib/categories";
import type { ClassStat, Overview, ResultRow } from "@/lib/admin-types";
import { Card, pct } from "./shared";

function turnoutByCategory(classes: ClassStat[]) {
  const map = new Map<string, { total: number; used: number }>();
  for (const c of classes) {
    const t = map.get(c.category) ?? { total: 0, used: 0 };
    t.total += c.total;
    t.used += c.used;
    map.set(c.category, t);
  }
  return map;
}

export function Results({ overview }: { overview: Overview }) {
  const turnout = turnoutByCategory(overview.classes);
  const categories = overview.voting.map((s) => s.category);
  const rowsFor = (cat: Category) =>
    overview.results && overview.results.some((r) => r.category === cat) ? overview.results.filter((r) => r.category === cat) : null;
  const anyHidden = categories.some((cat) => rowsFor(cat) === null);

  return (
    <Card
      id="hasil"
      title="Hasil per kategori"
      description={
        anyHidden
          ? overview.role === "MASTER"
            ? "Perolehan suara sebuah kategori disembunyikan selama pemungutan suaranya dibuka, agar pilihan pemilih tetap rahasia."
            : "Perolehan suara muncul setelah pemungutan suara ditutup dan master mengumumkan hasil."
          : undefined
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((cat) => (
          <CategoryResult key={cat} category={cat} turnout={turnout.get(cat) ?? { total: 0, used: 0 }} rows={rowsFor(cat)} />
        ))}
      </div>
    </Card>
  );
}

function CategoryResult({
  category,
  turnout,
  rows,
}: {
  category: Category;
  turnout: { total: number; used: number };
  rows: ResultRow[] | null;
}) {
  const totalVotes = rows?.reduce((s, r) => s + r.votes, 0) ?? 0;
  const maxVotes = rows ? Math.max(0, ...rows.map((r) => r.votes)) : 0;

  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-bold">{CATEGORY_LABEL[category]}</h3>
        <p className="text-sm text-muted tabular-nums">
          Partisipasi {turnout.used}/{turnout.total} ({pct(turnout.used, turnout.total)}%)
        </p>
      </div>
      {/* Saat perolehan SMA disembunyikan, partisipasi ditampilkan sebagai batang. */}
      {!rows && category.startsWith("SMA_") && (
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-paper">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct(turnout.used, turnout.total)}%` }} />
        </div>
      )}
      {rows && (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const leading = totalVotes > 0 && r.votes === maxVotes;
            return (
              <li key={r.candidate_id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className={leading ? "font-bold" : ""}>{r.is_blank ? "Kotak Kosong" : `${r.number}. ${r.name}`}</span>
                  <span className="shrink-0 tabular-nums">
                    {r.votes} suara · {pct(r.votes, totalVotes)}%
                  </span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-paper">
                  <div
                    className={`h-full rounded-full ${r.is_blank ? "bg-muted/40" : "bg-brand"}`}
                    style={{ width: `${pct(r.votes, totalVotes)}%` }}
                  />
                </div>
              </li>
            );
          })}
          <li className="border-t border-line pt-2 text-right text-sm text-muted tabular-nums">Total {totalVotes} suara</li>
        </ul>
      )}
    </div>
  );
}
