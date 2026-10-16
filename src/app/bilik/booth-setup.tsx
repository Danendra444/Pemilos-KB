"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BoothSetup() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/booth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Gagal mengaktifkan bilik.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    }
    setBusy(false);
  }

  const input = "mt-1.5 w-full rounded-lg border border-control bg-white px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form onSubmit={submit} className="w-full max-w-md rounded-xl border border-line bg-white p-6 sm:p-8">
      <h1 className="text-2xl font-bold">Aktifkan bilik</h1>
      <p className="mt-2 text-muted">Khusus panitia. Lakukan di setiap iPad bilik pada pagi hari pemilihan; setelah itu pemilih cukup memasukkan token. Bilik berlaku sampai pukul 23.59 WIB hari itu.</p>

      <label htmlFor="username" className="mt-6 block text-sm font-semibold">
        Username
      </label>
      <input
        id="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        maxLength={40}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        className={input}
      />

      <label htmlFor="sandi" className="mt-4 block text-sm font-semibold">
        Password
      </label>
      <input
        id="sandi"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className={`${input} font-mono tracking-wider`}
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !username.trim() || !password}
        className="mt-6 w-full rounded-lg bg-brand py-3.5 text-lg font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Memeriksa…" : "Aktifkan bilik"}
      </button>
    </form>
  );
}
