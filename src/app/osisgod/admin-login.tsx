"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Image from "next/image";
import { inputClass } from "./panel/shared";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const working = busy || refreshing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        // Tombol tetap terkunci sampai halaman selesai dimuat ulang, tanpa macet bila sesi tidak terpasang.
        startRefresh(() => router.refresh());
        setBusy(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Gagal masuk.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-8 w-full max-w-sm rounded-xl border border-line bg-white p-6 sm:mt-16 sm:p-8">
      <Image src="/logo-osis.png" alt="Logo OSIS Kharisma Bangsa" width={56} height={56} className="mb-4 h-14 w-14" priority />
      <h1 className="text-2xl font-bold">Masuk Admin</h1>
      <p className="mt-1 text-sm text-muted">Panel panitia pemilihan OSIS.</p>
      <label htmlFor="username" className="mt-6 block text-sm font-semibold">
        Username
      </label>
      <input
        id="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
        aria-describedby={error ? "login-error" : undefined}
        className={inputClass}
      />
      <label htmlFor="password" className="mt-4 block text-sm font-semibold">
        Password
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        aria-describedby={error ? "login-error" : undefined}
        className={inputClass}
      />
      {error && (
        <p id="login-error" role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={working || !username.trim() || !password}
        className="mt-6 w-full rounded-lg bg-brand py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {working ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
