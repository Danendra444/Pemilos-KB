"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Overview } from "@/lib/admin-types";
import { api, secondaryButton } from "./panel/shared";
import { Summary } from "./panel/summary";
import { Booths } from "./panel/booths";
import { Results } from "./panel/results";
import { GenerateTokens } from "./panel/generate-tokens";
import { ClassList } from "./panel/class-list";
import { ResetElection } from "./panel/reset";
import { ClearTrial } from "./panel/trial";
import { AdminAccounts } from "./panel/admin-accounts";

const REFRESH_MS = 10_000;

/** Bagian panel untuk navigasi lompat; `master` menandai bagian yang hanya ada di panel Master. */
const SECTIONS = [
  { id: "ringkasan", label: "Pemungutan suara" },
  { id: "hasil", label: "Hasil" },
  { id: "token", label: "Token" },
  { id: "bilik", label: "Bilik" },
  { id: "akun", label: "Akun panitia", master: true },
  { id: "uji-coba", label: "Uji coba", master: true },
  { id: "reset", label: "Reset", master: true },
];

const TITLE = { MASTER: "Panel Master", PUTRA: "Panel Panitia Putra", PUTRI: "Panel Panitia Putri" } as const;

export default function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const showCreate = creating || overview?.classes.length === 0;

  const load = useCallback(
    () =>
      api("/api/admin/overview").then(
        (data: Overview) => {
          setOverview(data);
          setError("");
        },
        (e) => {
          if ((e as { status?: number }).status === 401) router.refresh();
          else setError((e as Error).message);
        },
      ),
    [router],
  );

  useEffect(() => {
    load();
    // Tab yang tidak terlihat tidak perlu menarik data; saat kembali terlihat, langsung muat ulang.
    const id = setInterval(() => !document.hidden && load(), REFRESH_MS);
    const onVisible = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="w-full max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{overview ? TITLE[overview.role] : "Panel Panitia"}</h1>
          <p className="text-sm text-muted">Data diperbarui otomatis setiap 10 detik.</p>
        </div>
        <button onClick={logout} className={secondaryButton}>
          Keluar
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <p>{overview ? `Data tidak bisa diperbarui: ${error} Yang tampil di bawah mungkin sudah lama.` : error}</p>
          <button type="button" onClick={() => load()} className={secondaryButton}>
            Coba lagi
          </button>
        </div>
      )}

      {overview && (
        <nav aria-label="Bagian panel" className="sticky top-0 z-10 -mt-2 mb-4 flex gap-1 overflow-x-auto [scrollbar-width:thin] border-b border-line bg-paper py-2">
          {SECTIONS.filter((s) => !s.master || overview.role === "MASTER").map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-white hover:text-ink"
            >
              {s.label}
            </a>
          ))}
        </nav>
      )}

      {!overview ? (
        error ? null : (
          <p role="status" className="text-muted">
            Memuat…
          </p>
        )
      ) : (
        <div className="grid gap-6">
          <Summary overview={overview} onChange={load} />
          <Results overview={overview} />
          {overview.role === "MASTER" ? (
            // Form tambah token disembunyikan setelah token dibuat, agar daftar kelas mendapat lebar penuh.
            // ClassList selalu di posisi yang sama supaya filter dan kelas yang dibuka tidak hilang.
            <div className="grid items-start gap-6 lg:grid-cols-5">
              {showCreate && (
                <GenerateTokens
                  onDone={load}
                  onClose={overview.classes.length > 0 ? () => setCreating(false) : undefined}
                  className="lg:col-span-2"
                />
              )}
              <ClassList
                classes={overview.classes}
                canDelete
                onChange={load}
                action={
                  !showCreate && (
                    <button type="button" onClick={() => setCreating(true)} className={secondaryButton}>
                      Tambah token
                    </button>
                  )
                }
                className={showCreate ? "lg:col-span-3" : "lg:col-span-5"}
              />
            </div>
          ) : (
            <ClassList classes={overview.classes} canDelete={false} onChange={load} />
          )}
          <Booths role={overview.role} accounts={overview.accounts} thisBooth={overview.thisBooth} onlineLinks={overview.onlineLinks} onChange={load} />
          {overview.role === "MASTER" && <AdminAccounts accounts={overview.adminAccounts ?? []} onChange={load} />}
          {overview.role === "MASTER" && <ClearTrial onDone={load} />}
          {overview.role === "MASTER" && <ResetElection onDone={load} />}
        </div>
      )}
    </div>
  );
}
