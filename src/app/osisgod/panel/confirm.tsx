"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { primaryButton, secondaryButton } from "./shared";

export type Confirmation = {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  /** Aksi yang tidak bisa dibatalkan memakai warna bahaya; aksi biasa memakai warna utama. */
  tone?: "danger" | "default";
  /** Jika diisi, tombol konfirmasi baru aktif setelah kata ini diketik, seperti reset pemilihan. */
  word?: string;
  action: () => void;
};

/** Pengganti window.confirm: `ask(...)` membuka jendela, `dialog` harus dirender di komponen pemanggil. */
export function useConfirm() {
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const close = useCallback(() => setConfirmation(null), []);
  const dialog = confirmation && <ConfirmDialog confirmation={confirmation} onClose={close} />;
  return [dialog, setConfirmation] as const;
}

function ConfirmDialog({ confirmation, onClose }: { confirmation: Confirmation; onClose: () => void }) {
  const { word, tone = "danger" } = confirmation;
  const [typed, setTyped] = useState("");
  const dialogRef = useRef<HTMLFormElement>(null);
  const ready = !word || typed === word;

  // Dibaca saat render, sebelum autoFocus memindahkan fokus ke dalam jendela.
  const [opener] = useState(() => document.activeElement);

  // Menutup jendela, lalu fokus kembali ke tombol yang membukanya.
  const dismiss = useCallback(() => {
    onClose();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  }, [onClose, opener]);

  // Esc menutup; Tab berputar di dalam jendela agar fokus tidak lari ke halaman di belakangnya.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return dismiss();
      if (e.key !== "Tab") return;
      const items = dialogRef.current?.querySelectorAll<HTMLElement>("input, button:not(:disabled)");
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismiss]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    dismiss();
    confirmation.action();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" onClick={dismiss}>
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-xl border bg-white p-5 shadow-xl sm:p-6 ${tone === "danger" ? "border-danger-line" : "border-line"}`}
      >
        <h2 id="confirm-title" className={`text-lg font-bold ${tone === "danger" ? "text-danger" : ""}`}>
          {confirmation.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{confirmation.body}</p>
        {word && (
          <>
            <label htmlFor="confirm-word" className="mt-4 block text-sm font-semibold">
              Ketik <span className="font-mono">{word}</span> untuk konfirmasi
            </label>
            <input
              id="confirm-word"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
              className="mt-1.5 block w-full rounded-lg border border-line bg-white px-3 py-2.5 font-mono outline-none focus:border-danger focus:ring-2 focus:ring-danger/15"
            />
          </>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {/* Tanpa kata konfirmasi, fokus awal di Batal agar Enter tidak langsung menjalankan aksi. */}
          <button type="button" onClick={dismiss} autoFocus={!word} className={secondaryButton}>
            Batal
          </button>
          <button
            type="submit"
            disabled={!ready}
            className={
              tone === "danger"
                ? "rounded-lg bg-danger px-5 py-2.5 font-semibold text-white hover:bg-danger-dark disabled:opacity-40"
                : `${primaryButton} disabled:opacity-40`
            }
          >
            {confirmation.confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
