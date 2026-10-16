"use client";

import { useId } from "react";

export async function api(url: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("Tidak dapat terhubung ke server. Periksa koneksi internet.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Terjadi kesalahan."), { status: res.status });
  return data;
}

export const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export const inputClass =
  "mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";
export const primaryButton = "rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60";
export const secondaryButton = "rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium hover:bg-paper disabled:opacity-60";

export type Msg = { ok: boolean; text: string } | null;

export function Card({
  id,
  title,
  description,
  action,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  return (
    <section id={id} aria-labelledby={titleId} className={`scroll-mt-16 rounded-xl border border-line bg-white p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Message({ message, className = "" }: { message: Msg; className?: string }) {
  if (!message) return null;
  return (
    <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-ok" : "text-danger"} ${className}`}>
      {message.text}
    </p>
  );
}

/** Password acak yang mudah diketik (tanpa 0/O/1/I/L), mis. "k7pm3xq9". */
export function randomPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Kotak yang menampilkan akun baru sampai ditutup, karena password tidak bisa dilihat lagi. */
export function IssuedCredentials({
  username,
  password,
  onClose,
  children,
}: {
  username: string;
  password: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className="mb-5 rounded-lg border border-brand/30 bg-brand-soft p-4">
      <p className="text-sm">{children}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
        <dt className="text-sm text-muted">Username</dt>
        <dd className="min-w-0 font-mono text-lg font-semibold break-all select-all">{username}</dd>
        <dt className="text-sm text-muted">Password</dt>
        <dd className="min-w-0 font-mono text-2xl font-bold tracking-wider break-all text-brand select-all">{password}</dd>
      </dl>
      <button type="button" onClick={onClose} className="mt-3 text-sm font-medium text-brand hover:underline">
        Sudah dicatat, tutup
      </button>
    </div>
  );
}

export function PasswordField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-1.5 flex gap-2">
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        className={`${inputClass.replace("mt-1.5 ", "")} font-mono`}
      />
      <button type="button" onClick={() => onChange(randomPassword())} className={`${secondaryButton} shrink-0`}>
        Acak
      </button>
    </div>
  );
}
