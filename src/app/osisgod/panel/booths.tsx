"use client";

import { useState } from "react";
import type { BoothAccountRow } from "@/lib/admin-types";
import { BOOTH_PASSWORD_MIN, BOOTH_USERNAME_PATTERN } from "@/lib/booth-username";
import { SIDE_LABEL, SIDES, type AdminRole, type Side } from "@/lib/sides";
import { useConfirm } from "./confirm";
import { api, Card, inputClass, IssuedCredentials, Message, PasswordField, primaryButton, secondaryButton, type Msg } from "./shared";

export function Booths({
  role,
  accounts,
  thisBooth,
  onlineLinks,
  onChange,
}: {
  role: AdminRole;
  accounts: BoothAccountRow[];
  thisBooth: string | null;
  onlineLinks: { side: Side; path: string }[];
  onChange: () => void;
}) {
  const isMaster = role === "MASTER";
  const [dialog, ask] = useConfirm();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [side, setSide] = useState<Side | "">("");
  const [editing, setEditing] = useState<{ id: string; password: string } | null>(null);
  // Username + password yang baru disimpan, ditampilkan sampai ditutup agar sempat dicatat.
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);
  const activeCount = accounts.filter((a) => a.device).length;

  async function run(fn: () => Promise<string | null>) {
    setBusy(true);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ ok: true, text });
      onChange();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
    setBusy(false);
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    run(async () => {
      await api("/api/admin/booth-accounts", { action: "create", username: name, password, side });
      setIssued({ username: name, password: password.trim() });
      setUsername("");
      setPassword("");
      setSide("");
      return null;
    });
  }

  function savePassword(e: React.FormEvent, name: string) {
    e.preventDefault();
    if (!editing) return;
    run(async () => {
      await api("/api/admin/booth-accounts", { action: "password", id: editing.id, password: editing.password });
      setIssued({ username: name, password: editing.password.trim() });
      setEditing(null);
      return null;
    });
  }

  function remove(id: string, name: string) {
    ask({
      title: `Hapus akun ${name}?`,
      body: "Laptop yang memakai akun ini tidak bisa dipakai memilih lagi.",
      confirmLabel: "Hapus akun",
      action: () =>
        run(async () => {
          await api("/api/admin/booth-accounts", { action: "delete", id });
          return `Akun ${name} dihapus.`;
        }),
    });
  }

  function revoke(deviceId: string, label: string) {
    const all = deviceId === "all";
    ask({
      title: all ? `Cabut semua bilik${isMaster ? "" : ` ${SIDE_LABEL[role as Side].toLowerCase()}`}?` : `Cabut ${label}?`,
      body: all
        ? "Tidak ada laptop yang bisa dipakai memilih sampai bilik diaktifkan lagi."
        : "Laptop itu tidak bisa dipakai memilih sampai diaktifkan lagi.",
      confirmLabel: all ? "Cabut semua" : "Cabut",
      // Mencabut semua bilik menghentikan pemilihan di semua laptop, jadi perlu diketik.
      word: all ? "CABUT" : undefined,
      action: () =>
        run(async () => {
          await api("/api/admin/booths/revoke", { id: deviceId });
          return all ? "Semua bilik dicabut." : `${label} dicabut.`;
        }),
    });
  }

  return (
    <Card
      id="bilik"
      title="Bilik pemilihan"
      description={
        isMaster ? (
          <>
            Buat satu akun untuk setiap iPad bilik dan pilih sisinya, lalu aktifkan iPad-nya di{" "}
            <span className="font-mono text-ink">/bilik</span>. Bilik putra hanya menerima token putra, dan sebaliknya. Satu akun hanya aktif
            di satu iPad dan berlaku sampai pukul 23.59 WIB pada hari aktivasi.
          </>
        ) : (
          "iPad bilik yang terdaftar untuk sisi ini. Cabut jika iPad hilang atau tidak dipakai lagi."
        )
      }
      action={
        activeCount > 1 && (
          <button onClick={() => revoke("all", "")} disabled={busy} className={`${secondaryButton} text-danger`}>
            Cabut semua
          </button>
        )
      }
    >
      {dialog}
      <Message message={message} className="mb-4" />
      {issued && (
        <IssuedCredentials username={issued.username} password={issued.password} onClose={() => setIssued(null)}>
          Akun <strong>{issued.username}</strong> tersimpan. Catat sekarang: password tidak bisa dilihat lagi setelah kotak ini ditutup. Jika laptop
          bilik ini sudah aktif sebelumnya, aktifkan ulang dengan password ini.
        </IssuedCredentials>
      )}

      <div className={isMaster ? "grid gap-6 lg:grid-cols-2" : ""}>
        <div>
          {accounts.length === 0 ? (
            <p className="rounded-lg bg-paper px-4 py-3 text-sm text-muted">Belum ada akun bilik.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {accounts.map((a) => (
                <li key={a.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.device ? "bg-ok" : "bg-muted/30"}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono font-semibold">{a.name}</p>
                      <p className="text-sm text-muted">
                        {isMaster && (a.side ? `${SIDE_LABEL[a.side]} · ` : "")}
                        {a.side === null ? (
                          <span className="text-danger">Tanpa sisi. Hapus lalu buat ulang.</span>
                        ) : a.device ? (
                          `Aktif sejak ${new Date(a.device.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`
                        ) : (
                          "Belum aktif"
                        )}
                        {thisBooth && a.device && thisBooth === a.name ? " · perangkat ini" : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {a.device && (
                        <button
                          onClick={() => revoke(a.device!.id, a.name)}
                          disabled={busy}
                          className="rounded-md px-2 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
                        >
                          Cabut
                        </button>
                      )}
                      {isMaster && (
                        <>
                          <button
                            onClick={() => setEditing(editing?.id === a.id ? null : { id: a.id, password: "" })}
                            disabled={busy}
                            aria-expanded={editing?.id === a.id}
                            className="rounded-md px-2 py-1.5 text-sm font-medium hover:bg-paper disabled:opacity-60"
                          >
                            Ganti password
                          </button>
                          <button
                            onClick={() => remove(a.id, a.name)}
                            disabled={busy}
                            className="rounded-md px-2 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {editing?.id === a.id && (
                    <form onSubmit={(e) => savePassword(e, a.name)} className="mt-3 rounded-lg bg-paper p-3">
                      <label htmlFor={`pw-${a.id}`} className="text-sm font-semibold">
                        Password baru untuk {a.name}
                      </label>
                      <PasswordField id={`pw-${a.id}`} value={editing.password} onChange={(v) => setEditing({ ...editing, password: v })} />
                      <div className="mt-3 flex gap-2">
                        <button type="submit" disabled={busy || editing.password.trim().length < BOOTH_PASSWORD_MIN} className={primaryButton}>
                          Simpan
                        </button>
                        <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>
                          Batal
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {isMaster && (
          <form onSubmit={create} className="space-y-3 self-start rounded-lg border border-line p-4">
            <p className="font-semibold">Tambah akun bilik</p>
            <div>
              <label htmlFor="bilik-sisi" className="text-sm font-semibold">
                Sisi
              </label>
              <select id="bilik-sisi" value={side} onChange={(e) => setSide(e.target.value as Side)} className={`${inputClass} pr-10`} required>
                <option value="" disabled>
                  Pilih…
                </option>
                {SIDES.map((s) => (
                  <option key={s} value={s}>
                    {SIDE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bilik-username" className="text-sm font-semibold">
                Username
              </label>
              <input
                id="bilik-username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                maxLength={30}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className={`${inputClass} font-mono`}
              />
              <p className="mt-1 text-sm text-muted">Huruf kecil, angka, - atau _, 3–30 karakter.</p>
            </div>
            <div>
              <label htmlFor="bilik-password" className="text-sm font-semibold">
                Password
              </label>
              <PasswordField id="bilik-password" value={password} onChange={setPassword} />
              <p className="mt-1 text-sm text-muted">Minimal {BOOTH_PASSWORD_MIN} karakter. Huruf besar dan kecil dibedakan.</p>
            </div>
            <button
              type="submit"
              disabled={busy || !side || !BOOTH_USERNAME_PATTERN.test(username) || password.trim().length < BOOTH_PASSWORD_MIN}
              className={primaryButton}
            >
              Buat akun
            </button>
          </form>
        )}
      </div>

      <OnlineLinks links={onlineLinks} />
    </Card>
  );
}

/** Tautan untuk guru yang tidak bisa datang ke bilik: perangkatnya menjadi bilik yang hanya menerima token guru. */
function OnlineLinks({ links }: { links: { side: Side; path: string }[] }) {
  const [copied, setCopied] = useState<Side | null>(null);
  // Alamat lengkap baru diketahui di browser.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function copy(side: Side, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(side);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="font-semibold">Tautan online guru</p>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Untuk guru yang tidak bisa memilih di bilik. Kirim tautan sisinya ke guru tersebut; guru membukanya di HP atau laptop, lalu
        memasukkan token guru miliknya. Tautan ini hanya menerima token guru, dan perlu dibuka ulang setiap hari pemilihan.
      </p>
      <ul className="mt-3 space-y-2">
        {links.map(({ side, path }) => {
          const url = origin + path;
          return (
            <li key={side} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line px-4 py-3">
              <span className="w-12 shrink-0 text-sm font-semibold">{SIDE_LABEL[side]}</span>
              <span className="min-w-0 flex-1 break-all font-mono text-sm">{url}</span>
              <button type="button" onClick={() => copy(side, url)} className={secondaryButton}>
                {copied === side ? "Tersalin" : "Salin"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
