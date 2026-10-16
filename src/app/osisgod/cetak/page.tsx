import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/supabase";
import { CATEGORY_LABEL, isCategory } from "@/lib/categories";
import { canManage } from "@/lib/sides";
import { normalizeToken } from "@/lib/token";
import PrintButton from "./print-button";

// Judul halaman dipakai browser sebagai nama file saat "Simpan sebagai PDF".
export async function generateMetadata({ searchParams }: PageProps<"/osisgod/cetak">): Promise<Metadata> {
  const { kelas, kategori, kode } = await searchParams;
  const parts = ["Token", typeof kelas === "string" && kelas ? kelas : "—"];
  if (isCategory(kategori)) parts.push(CATEGORY_LABEL[kategori]);
  const single = normalizeToken(kode);
  if (single) parts.push(single);
  return { title: parts.join(" ") };
}

// "Guru SMP Putra" · SMP Putra → "Guru" · SMP Putra: kategori sudah ditulis di sebelahnya.
function slipClassName(className: string, category: string): string {
  const label = isCategory(category) ? CATEGORY_LABEL[category] : "";
  return label && className.endsWith(` ${label}`) ? className.slice(0, -label.length - 1) : className;
}

export default async function PrintTokensPage({ searchParams }: PageProps<"/osisgod/cetak">) {
  const admin = await currentAdmin();
  if (!admin) redirect("/osisgod");

  const { kelas, kategori, kode } = await searchParams;
  const className = typeof kelas === "string" ? kelas : "";
  // ?kode=… mencetak satu slip saja (mis. setelah token diganti).
  const single = typeof kode === "string" ? normalizeToken(kode) : null;

  // Kategori wajib: nama kelas yang sama bisa ada di beberapa kategori, dan admin sisi
  // hanya boleh mencetak kategori sisinya.
  if (!isCategory(kategori) || !canManage(admin.role, kategori)) notFound();

  let query = db()
    .from("tokens")
    .select("code, category, student_name, used")
    .eq("class_name", className)
    .order("student_name", { nullsFirst: false })
    .order("created_at")
    .order("code");
  query = query.eq("category", kategori);
  if (single) query = query.eq("code", single);
  const { data, error } = await query;
  if (error) throw error;

  const unused = data.filter((t) => !t.used);
  const usedCount = data.length - unused.length;
  const rows = Array.from({ length: Math.ceil(unused.length / 3) }, (_, i) => unused.slice(i * 3, i * 3 + 3));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 print:max-w-none print:p-0">
      <Link href="/osisgod" className="no-print mb-4 inline-block rounded-md px-2 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft">
        ← Kembali ke panel
      </Link>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
        <div>
          <h1 className="text-xl font-bold">
            {single && unused[0]?.student_name ? `Token ${unused[0].student_name}` : `Token ${className || "—"}`}
          </h1>
          <p className="text-sm text-muted">
            {single
              ? unused.length > 0 && `${className}. Gunting di garis putus-putus.`
              : `${unused.length} token belum terpakai akan dicetak${
                  usedCount > 0 ? ` (${usedCount} token yang sudah terpakai tidak dicetak)` : ""
                }. Gunting di garis putus-putus.`}
          </p>
        </div>
        <PrintButton disabled={unused.length === 0} />
      </div>

      {unused.length === 0 ? (
        <p className="text-muted">{single ? "Token ini sudah terpakai atau tidak ditemukan." : "Tidak ada token untuk dicetak di kelas ini."}</p>
      ) : (
        // Dikelompokkan per baris: Chrome tidak menghormati break-inside pada item grid,
        // tetapi menghormatinya pada blok baris, sehingga kartu tidak terpotong antarhalaman.
        // Lebar tetap dalam mm saat dicetak agar muat di A4 di semua browser (Safari memakai lebar halaman yang berbeda).
        <div className="token-sheet">
          {rows.map((row) => (
            <div key={row[0].code} className="grid grid-cols-3 break-inside-avoid">
              {row.map((t) => (
                <div key={t.code} className="border border-dashed border-muted/50 bg-white p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Image src="/logo-osis.png" alt="" width={20} height={20} className="h-5 w-5" />
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand">Pemilihan Ketua OSIS</p>
                  </div>
                  {t.student_name && <p className="mt-2 text-sm font-bold leading-snug break-words">{t.student_name}</p>}
                  <p className={`${t.student_name ? "" : "mt-1"} text-xs break-words`}>
                    <strong>{slipClassName(className, t.category)}</strong> · {isCategory(t.category) ? CATEGORY_LABEL[t.category] : t.category}
                  </p>
                  <p className="my-3 font-mono text-3xl font-bold tracking-[0.25em] text-brand">{t.code}</p>
                  <p className="text-[10px] leading-snug text-muted">
                    Masukkan token ini di bilik pemilihan.
                    <br />
                    Hanya berlaku satu kali. Jangan tunjukkan ke orang lain.
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
