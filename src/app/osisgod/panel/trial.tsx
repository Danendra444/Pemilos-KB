"use client";

import { useState } from "react";
import { useConfirm } from "./confirm";
import { api, Card, Message, secondaryButton, type Msg } from "./shared";

export function ClearTrial({ onDone }: { onDone: () => void }) {
  const [dialog, ask] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg>(null);

  async function clear() {
    setBusy(true);
    setMessage(null);
    try {
      const { deleted } = await api("/api/admin/trial/clear", {});
      setMessage({ ok: true, text: `${deleted} token uji coba dihapus. Semua suara kembali ke 0.` });
      onDone();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <Card
      id="uji-coba"
      title="Data uji coba"
      description={
        <>
          Menghapus semua token di kelas <strong>Uji Coba</strong> dan mengembalikan semua suara ke 0. Token kelas lain tetap tersimpan.
          Hanya bisa dipakai saat pemungutan suara kedua sisi tertutup dan belum ada token kelas lain yang terpakai.
        </>
      }
    >
      {dialog}
      <button
        type="button"
        onClick={() =>
          ask({
            title: "Hapus data uji coba?",
            body: "Semua token kelas Uji Coba dihapus dan semua suara kembali ke 0.",
            confirmLabel: "Hapus data uji coba",
            action: clear,
          })
        }
        disabled={busy}
        className={secondaryButton}
      >
        {busy ? "Menghapus…" : "Hapus data uji coba"}
      </button>
      <Message message={message} className="mt-3" />
    </Card>
  );
}
