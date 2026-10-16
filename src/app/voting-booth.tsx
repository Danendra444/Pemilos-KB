"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { candidatePhoto, splitPair, type Candidate, type Role } from "@/lib/categories";

type Ballot = { token: string; category: string; categoryLabel: string; candidates: Candidate[] };

type Step =
  | { name: "token" }
  | { name: "choose"; ballot: Ballot; selected: Candidate | null; confirming: boolean; sendUncertain?: boolean }
  | { name: "done" };

const DONE_SECONDS = 5;
const IDLE_SECONDS = 120;
const WARN_SECONDS = 20;

/** status 0: permintaan tidak sampai atau jawabannya tidak diterima. */
async function post(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Tidak dapat terhubung ke server. Periksa koneksi internet." } };
  }
}

const SEND_UNCERTAIN =
  "Koneksi terputus saat mengirim, jadi belum pasti suaramu tercatat. Tekan tombol di bawah untuk mengirim lagi. Suaramu tidak akan tercatat dua kali.";

const STEPS = ["Token", "Pilih", "Konfirmasi"];

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm short:mb-3" aria-label="Langkah">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "now" : "next";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "now" ? "step" : undefined}>
            {i > 0 && <span className="h-px w-6 bg-line sm:w-10" aria-hidden />}
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                state === "next" ? "border border-line bg-white text-muted" : "bg-brand text-white"
              }`}
            >
              {i + 1}
            </span>
            <span className={state === "now" ? "font-semibold" : "text-muted"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Foto potret calon; menampilkan siluet jika file belum diunggah. */
function Portrait({ category, number, role, name, className = "" }: { category: string; number: number; role: Role; name: string; className?: string }) {
  const src = candidatePhoto(category, number, role);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <div className={`relative aspect-[3/4] overflow-hidden rounded-lg bg-paper ${className}`}>
      {failedSrc === src ? (
        <svg viewBox="0 0 60 80" className="absolute inset-0 h-full w-full text-line" fill="currentColor" aria-hidden>
          <circle cx="30" cy="30" r="12" />
          <path d="M8 80c0-15 10-24 22-24s22 9 22 24z" />
        </svg>
      ) : (
        <Image src={src} alt={`Foto ${name}`} fill sizes="(min-width: 640px) 220px, 45vw" className="object-cover" onError={() => setFailedSrc(src)} />
      )}
    </div>
  );
}

export default function VotingBooth() {
  const [step, setStep] = useState<Step>({ name: "token" });
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(DONE_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);

  function restart() {
    setStep({ name: "token" });
    setTokenInput("");
    setError("");
    setBusy(false);
  }

  // Layar "tercatat": hitung mundur lalu kembali ke awal.
  useEffect(() => {
    if (step.name !== "done") return;
    const tick = setInterval(() => setCountdown((n) => Math.max(0, n - 1)), 1000);
    const back = setTimeout(restart, DONE_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(back);
    };
  }, [step.name]);

  // Jika pemilih meninggalkan layar pilihan, kembali ke awal agar token tidak terlihat orang lain.
  // Setiap sentuhan, ketukan tombol, atau guliran mengulang hitungan; WARN_SECONDS terakhir diberi peringatan.
  const [idleLeft, setIdleLeft] = useState<number | null>(null);
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    if (step.name !== "choose") return;
    let deadline = Date.now() + IDLE_SECONDS * 1000;
    const onActivity = () => {
      deadline = Date.now() + IDLE_SECONDS * 1000;
      setIdleLeft(null);
    };
    const tick = setInterval(() => {
      if (busyRef.current) return onActivity();
      const left = Math.ceil((deadline - Date.now()) / 1000);
      if (left <= 0) restart();
      else setIdleLeft(left <= WARN_SECONDS ? left : null);
    }, 1000);
    const events = ["pointerdown", "keydown", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      clearInterval(tick);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      setIdleLeft(null);
    };
  }, [step.name]);

  useEffect(() => {
    if (step.name === "token") inputRef.current?.focus();
  }, [step.name]);

  // Esc menutup dialog konfirmasi.
  const confirmOpen = step.name === "choose" && step.confirming;
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setStep((s) => (s.name === "choose" ? { ...s, confirming: false } : s));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen, busy]);

  async function submitToken(e: React.FormEvent) {
    e.preventDefault();
    const token = tokenInput.toUpperCase().replace(/[\s-]/g, "");
    if (token.length !== 6) {
      setError("Token harus 6 karakter.");
      return;
    }
    setBusy(true);
    setError("");
    const { ok, data } = await post("/api/token/check", { token });
    setBusy(false);
    if (!ok) {
      setError(String(data.error ?? "Terjadi kesalahan. Coba lagi."));
      return;
    }
    setStep({
      name: "choose",
      ballot: {
        token,
        category: String(data.category),
        categoryLabel: String(data.categoryLabel),
        candidates: data.candidates as Candidate[],
      },
      selected: null,
      confirming: false,
    });
  }

  async function castVote() {
    if (step.name !== "choose" || !step.selected) return;
    setBusy(true);
    setError("");
    const { ok, status, data } = await post("/api/vote", {
      token: step.ballot.token,
      candidateId: step.selected.id,
    });
    setBusy(false);
    // Token terpakai setelah pengiriman yang jawabannya hilang berarti pengiriman itu sudah tercatat.
    if (ok || (status === 409 && step.sendUncertain)) {
      setCountdown(DONE_SECONDS);
      setStep({ name: "done" });
      return;
    }
    // Jawaban hilang atau server gagal: suara mungkin sudah tercatat walau pemilih melihat galat.
    const uncertain = status === 0 || status >= 500;
    setStep({ ...step, confirming: false, sendUncertain: step.sendUncertain || uncertain });
    setError(uncertain ? SEND_UNCERTAIN : String(data.error ?? "Terjadi kesalahan. Coba lagi."));
  }

  if (step.name === "done") {
    return (
      <section className="w-full max-w-md rounded-xl border border-line bg-white px-8 py-12 text-center" role="status" aria-live="polite">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Suaramu tercatat</h1>
        <p className="mt-2 text-muted">Terima kasih telah menggunakan hak pilihmu.</p>
        <p className="mt-10 border-t border-line pt-4 text-sm text-muted" aria-hidden>
          Kembali ke awal dalam {countdown} detik…
        </p>
      </section>
    );
  }

  if (step.name === "token") {
    return (
      <section className="w-full max-w-md">
        <Stepper current={0} />
        <div className="rounded-xl border border-line bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Masukkan token</h1>
          <p className="mt-2 text-muted">Token tertera di kertas yang kamu terima dari panitia. Token membuka surat suara sesuai kategorimu.</p>
          <form onSubmit={submitToken} noValidate className="mt-6">
            <label htmlFor="token" className="block text-sm font-semibold">
              Token
            </label>
            <input
              ref={inputRef}
              id="token"
              value={tokenInput}
              onChange={(e) => {
                setTokenInput(e.target.value.toUpperCase());
                setError("");
              }}
              maxLength={7}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="go"
              aria-invalid={!!error}
              aria-describedby={error ? "token-hint token-error" : "token-hint"}
              className="mt-2 w-full rounded-lg border border-control px-4 py-4 text-center font-mono text-3xl tracking-[0.4em] uppercase outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 aria-invalid:border-danger aria-invalid:ring-danger/15"
            />
            <p id="token-hint" className="mt-2 text-sm text-muted">
              6 karakter, contoh <span className="font-mono">K7PM3X</span>.
            </p>
            {error && (
              <p id="token-error" role="alert" className="mt-2 text-sm text-danger">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-lg bg-brand py-3.5 text-lg font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {busy ? "Memeriksa…" : "Buka surat suara"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted">Pilihanmu rahasia. Token hanya bisa dipakai satu kali.</p>
      </section>
    );
  }

  const { ballot, selected, confirming } = step;
  const pairs = ballot.candidates.filter((c) => !c.is_blank).length;

  return (
    <section className="w-full max-w-3xl">
      <Stepper current={confirming ? 2 : 1} />
      <div className="mb-6 flex items-start justify-between gap-4 border-b border-line pb-5 short:mb-4 short:pb-3">
        <div>
          <h1 className="text-2xl font-bold text-balance sm:text-3xl">Surat Suara {ballot.categoryLabel}</h1>
          <p className="mt-1 text-muted">
            {pairs > 1 ? "Pilih salah satu pasangan calon." : "Pilih pasangan calon atau kotak kosong."} Tekan kartunya untuk memilih.
          </p>
        </div>
        <button type="button" onClick={restart} className="min-h-11 shrink-0 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-paper">
          Batal
        </button>
      </div>

      <fieldset>
        <legend className="sr-only">Pasangan calon {ballot.categoryLabel}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {ballot.candidates.map((c) => {
            const active = selected?.id === c.id;
            const { ketua, wakil } = splitPair(c.name);
            return (
              <label
                key={c.id}
                className={`flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-white transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand ${
                  active ? "border-brand ring-1 ring-brand" : "border-control hover:border-muted"
                }`}
              >
                <input
                  type="radio"
                  name="candidate"
                  value={c.id}
                  checked={active}
                  onChange={() => {
                    setError("");
                    setStep({ ...step, selected: c });
                  }}
                  className="sr-only"
                />
                <span className={`flex items-center gap-3 border-b px-4 py-3 ${active ? "border-brand/20 bg-brand-soft" : "border-line"}`}>
                  {c.is_blank ? (
                    <span className="text-base font-semibold">Kotak Kosong</span>
                  ) : (
                    <>
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-lg font-bold text-white">{c.number}</span>
                      <span className="text-base font-semibold">Pasangan Calon Nomor {c.number}</span>
                    </>
                  )}
                  <span
                    className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      active ? "border-brand bg-brand text-white" : "border-control bg-white"
                    }`}
                    aria-hidden
                  >
                    {active && (
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={4}>
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </span>

                {c.is_blank ? (
                  <span className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                    <span className="aspect-[3/4] w-2/5 rounded-lg border-2 border-dashed border-line" aria-hidden />
                    <span className="text-sm text-muted">Tidak memilih pasangan calon</span>
                  </span>
                ) : (
                  <span className="grid grid-cols-2 gap-3 p-4">
                    {([["ketua", ketua, "Calon Ketua"], ["wakil", wakil, "Calon Wakil Ketua"]] as const).map(([role, person, title]) => (
                      <span key={role} className="flex flex-col">
                        <Portrait category={ballot.category} number={c.number} role={role} name={person} />
                        <span className="mt-3 text-xs font-medium text-muted">{title}</span>
                        <span className="mt-0.5 font-semibold leading-snug text-balance">{person || "—"}</span>
                      </span>
                    ))}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Menempel di bawah layar jika surat suara lebih tinggi dari layar, agar tombol selalu terlihat. */}
      <div className="sticky bottom-0 z-[5] -mx-4 mt-4 border-t border-line bg-paper px-4 py-4">
        {error && (
          <p role="alert" className="mb-3 text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="button"
          disabled={!selected}
          onClick={() => setStep({ ...step, confirming: true })}
          className="w-full rounded-lg bg-brand py-3.5 text-lg font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
        >
          {selected ? "Lanjut ke konfirmasi" : "Pilih salah satu terlebih dahulu"}
        </button>
      </div>

      {idleLeft !== null && (
        <div className="fixed inset-x-4 top-4 z-20 mx-auto flex max-w-md items-center gap-4 rounded-xl border border-line bg-white p-4 shadow-lg" role="alert">
          <p className="flex-1 text-sm">
            <span className="block font-semibold">Masih memilih?</span>
            <span className="text-muted">
              Layar kembali ke awal dalam <span className="tabular-nums">{idleLeft}</span> detik.
            </span>
          </p>
          {/* Sentuhan apa pun sudah mengulang hitungan; tombol ini memperjelas caranya. */}
          <button type="button" className="min-h-11 shrink-0 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
            Saya masih memilih
          </button>
        </div>
      )}

      {confirming && selected && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-xl bg-white p-6 sm:p-8">
            <h2 id="confirm-title" className="text-xl font-bold">
              Konfirmasi pilihan
            </h2>
            <p className="mt-1 text-sm text-muted">Pilihan tidak dapat diubah setelah dikirim.</p>
            <div className="mt-5 rounded-lg border border-line p-4">
              {selected.is_blank ? (
                <p className="text-lg font-bold">Kotak Kosong</p>
              ) : (
                <>
                  <p className="text-sm font-semibold">Pasangan Calon Nomor {selected.number}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {(["ketua", "wakil"] as const).map((role) => {
                      const person = splitPair(selected.name)[role];
                      return (
                        <div key={role} className="flex items-center gap-3">
                          <Portrait category={ballot.category} number={selected.number} role={role} name={person} className="w-12 shrink-0 rounded-md" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted">{role === "ketua" ? "Ketua" : "Wakil Ketua"}</p>
                            <p className="font-semibold leading-snug">{person || "—"}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStep({ ...step, confirming: false })}
                disabled={busy}
                className="rounded-lg border border-line py-3 font-semibold hover:bg-paper disabled:opacity-60"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={castVote}
                disabled={busy}
                autoFocus
                className="rounded-lg bg-brand py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {busy ? "Mengirim…" : "Ya, kirim suara"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
