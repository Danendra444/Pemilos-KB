"use client";

import { useState } from "react";
import type { AdminAccountRow } from "@/lib/admin-types";
import { BOOTH_PASSWORD_MIN, BOOTH_USERNAME_PATTERN } from "@/lib/booth-username";
import { SIDE_LABEL, SIDES, type Side } from "@/lib/sides";
import { api, Card, inputClass, IssuedCredentials, Message, PasswordField, primaryButton, secondaryButton, type Msg } from "./shared";

type Draft = { role: Side; username: string; password: string };

export function AdminAccounts({ accounts, onChange }: { accounts: AdminAccountRow[]; onChange: () => void }) {
  const [editing, setEditing] = useState<Draft | null>(null);
  // Ditampilkan sampai ditutup agar sempat dicatat; password tidak bisa dilihat lagi.
  const [issued, setIssued] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    try {
      const draft = { ...editing, username: editing.username.trim().toLowerCase(), password: editing.password.trim() };
      await api("/api/admin/admin-accounts", draft);
      setIssued(draft);
      setEditing(null);
      onChange();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    }
    setBusy(false);
  }

  return (
    <Card
      id="akun"
      title="Akun panitia"
      description="Satu akun untuk panitia putra dan satu untuk panitia putri. Masing-masing hanya aktif di satu perangkat. Mengganti password mengeluarkan perangkat yang sedang memakai akun itu."
    >
      {issued && (
        <IssuedCredentials username={issued.username} password={issued.password} onClose={() => setIssued(null)}>
          Akun panitia {SIDE_LABEL[issued.role].toLowerCase()} tersimpan. Catat sekarang: password tidak bisa dilihat lagi setelah kotak ini ditutup.
        </IssuedCredentials>
      )}

      <ul className="divide-y divide-line rounded-lg border border-line">
        {SIDES.map((role) => {
          const account = accounts.find((a) => a.role === role);
          const open = editing?.role === role;
          return (
            <li key={role} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Panitia {SIDE_LABEL[role]}</p>
                  <p className={`text-sm ${account ? "font-mono break-all" : "text-muted"}`}>{account ? account.username : "Belum dibuat"}</p>
                </div>
                <button
                  onClick={() => setEditing(open ? null : { role, username: account?.username ?? "", password: "" })}
                  disabled={busy}
                  aria-expanded={open}
                  className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-60"
                >
                  {account ? "Ganti" : "Buat akun"}
                </button>
              </div>
              {open && editing && (
                <form onSubmit={save} className="mt-3 space-y-3 rounded-lg bg-paper p-3">
                  <div>
                    <label htmlFor={`adm-user-${role}`} className="text-sm font-semibold">
                      Username
                    </label>
                    <input
                      id={`adm-user-${role}`}
                      value={editing.username}
                      onChange={(e) => setEditing({ ...editing, username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                      maxLength={30}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className={`${inputClass} font-mono`}
                    />
                    <p className="mt-1 text-sm text-muted">Huruf kecil, angka, - atau _, 3–30 karakter.</p>
                  </div>
                  <div>
                    <label htmlFor={`adm-pw-${role}`} className="text-sm font-semibold">
                      Password
                    </label>
                    <PasswordField id={`adm-pw-${role}`} value={editing.password} onChange={(v) => setEditing({ ...editing, password: v })} />
                    <p className="mt-1 text-sm text-muted">Minimal {BOOTH_PASSWORD_MIN} karakter. Huruf besar dan kecil dibedakan.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy || !BOOTH_USERNAME_PATTERN.test(editing.username) || editing.password.trim().length < BOOTH_PASSWORD_MIN}
                      className={primaryButton}
                    >
                      Simpan
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>
                      Batal
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      <Message message={message} className="mt-4" />
    </Card>
  );
}
