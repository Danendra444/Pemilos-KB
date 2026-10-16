"use client";

import { useState } from "react";
import type { Overview, VotingStatus } from "@/lib/admin-types";
import { CATEGORY_LABEL } from "@/lib/categories";
import { useConfirm } from "./confirm";
import { api, pct } from "./shared";

export function Summary({ overview, onChange }: { overview: Overview; onChange: () => void }) {
  const total = overview.classes.reduce((s, c) => s + c.total, 0);
  const used = overview.classes.reduce((s, c) => s + c.used, 0);

  const stats = [
    ["Token dibuat", total.toLocaleString("id-ID")],
    ["Token terpakai", used.toLocaleString("id-ID")],
    ["Partisipasi", `${pct(used, total)}%`],
    ["Bilik aktif", `${overview.accounts.filter((a) => a.device).length} / ${overview.accounts.length}`],
  ];

  return (
    <section id="ringkasan" aria-label="Pemungutan suara" className="scroll-mt-16 overflow-hidden rounded-xl border border-line bg-white">
      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-white px-5 py-4 sm:px-6">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-0.5 text-2xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {/* Satu sel per kategori; SMP di baris atas dan SMA di bawahnya. */}
      <div className="grid gap-px bg-line sm:grid-cols-2">
        {overview.voting.map((s) => (
          <VotingControl key={s.category} status={s} published={overview.resultsPublished} onChange={onChange} />
        ))}
      </div>
      {overview.role === "MASTER" && (
        <div className="border-t border-line">
          <PublishResults overview={overview} onChange={onChange} />
        </div>
      )}
    </section>
  );
}

function VotingControl({ status, published, onChange }: { status: VotingStatus; published: boolean; onChange: () => void }) {
  const { open, category } = status;
  const label = CATEGORY_LABEL[category];
  const [dialog, ask] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle() {
    ask(
      open
        ? {
            title: `Tutup pemungutan suara ${label}?`,
            body: `Pemilih ${label} tidak bisa memilih lagi. Pastikan tidak ada yang sedang memilih di bilik.`,
            confirmLabel: "Tutup pemungutan suara",
            word: "TUTUP",
            action: change,
          }
        : {
            title: `Buka pemungutan suara ${label}?`,
            body: `Perolehan suara ${label} disembunyikan selama pemungutan berlangsung.${published ? " Pengumuman hasil akan dibatalkan." : ""}`,
            confirmLabel: "Buka pemungutan suara",
            tone: "default",
            action: change,
          },
    );
  }

  async function change() {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/voting", { category, open: !open });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 sm:p-6">
      {dialog}
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${open ? "bg-ok motion-safe:animate-pulse" : "bg-muted/40"}`} aria-hidden />
        <div>
          <p className="text-sm text-muted">Pemungutan suara {label}</p>
          <p className="text-xl font-bold">{open ? "Dibuka" : "Ditutup"}</p>
        </div>
      </div>
      <div className="text-right">
        <button
          onClick={toggle}
          disabled={busy}
          className={`rounded-lg px-5 py-3 font-semibold disabled:opacity-60 ${
            open ? "border border-danger bg-white text-danger hover:bg-danger-soft" : "bg-ok text-white hover:bg-ok-dark"
          }`}
        >
          {open ? "Tutup pemungutan suara" : "Buka pemungutan suara"}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function PublishResults({ overview, onChange }: { overview: Overview; onChange: () => void }) {
  const allClosed = overview.voting.every((s) => !s.open);
  const [dialog, ask] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function publish() {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/results/publish", {});
      onChange();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
      {dialog}
      <div>
        <p className="text-sm text-muted">Hasil untuk panitia putra dan putri</p>
        <p className="text-xl font-bold">{overview.resultsPublished ? "Sudah diumumkan" : "Belum diumumkan"}</p>
        {!overview.resultsPublished && !allClosed && (
          <p className="mt-1 text-sm text-muted">Tutup pemungutan suara semua kategori terlebih dahulu.</p>
        )}
      </div>
      {!overview.resultsPublished && (
        <div className="text-right">
          <button
            onClick={() =>
              ask({
                title: "Umumkan hasil?",
                body: "Panitia putra dan putri akan bisa melihat perolehan suara sisinya.",
                confirmLabel: "Umumkan hasil",
                tone: "default",
                action: publish,
              })
            }
            disabled={busy || !allClosed}
            className="rounded-lg bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
          >
            Umumkan hasil
          </button>
          {error && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
