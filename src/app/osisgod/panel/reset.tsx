"use client";

import { useState } from "react";
import { api, Message, type Msg } from "./shared";

export function ResetElection({ onDone }: { onDone: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api("/api/admin/reset", { confirm });
      setConfirm("");
      setMessage({ ok: true, text: "Semua token dan suara telah dihapus. Pemungutan suara ditutup." });
      onDone();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <section id="reset" aria-labelledby="reset-title" className="scroll-mt-16 rounded-xl border border-danger-line bg-white p-5 sm:p-6">
      <h2 id="reset-title" className="text-lg font-bold text-danger">
        Reset pemilihan
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Menghapus <strong>semua token</strong> dan mengembalikan <strong>semua suara ke 0</strong>. Termasuk token yang sudah dicetak; untuk membersihkan uji coba saja, pakai{" "}
        <strong>Hapus data uji coba</strong>. Bilik yang terdaftar tidak ikut dihapus. Tidak bisa dibatalkan.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="reset-confirm" className="text-sm font-semibold">
            Ketik <span className="font-mono">RESET</span> untuk konfirmasi
          </label>
          <input
            id="reset-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="mt-1.5 block rounded-lg border border-line bg-white px-3 py-2.5 font-mono outline-none focus:border-danger focus:ring-2 focus:ring-danger/15"
          />
        </div>
        <button
          type="submit"
          disabled={busy || confirm !== "RESET"}
          className="rounded-lg bg-danger px-5 py-2.5 font-semibold text-white hover:bg-danger-dark disabled:opacity-40"
        >
          {busy ? "Menghapus…" : "Reset semua data"}
        </button>
      </form>
      <Message message={message} className="mt-3" />
    </section>
  );
}
