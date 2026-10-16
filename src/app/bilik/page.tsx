import type { Metadata } from "next";
import Link from "next/link";
import { currentBooth } from "@/lib/booth";
import { SIDE_LABEL } from "@/lib/sides";
import BoothSetup from "./booth-setup";

export const metadata: Metadata = { title: "Aktifkan Bilik — Pemilihan Ketua OSIS" };

export default async function BoothPage() {
  const booth = await currentBooth();
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12">
      {booth ? (
        <section className="w-full max-w-md rounded-xl border border-line bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Bilik sudah aktif</h1>
          <p className="mt-2 text-muted">
            Perangkat ini terdaftar sebagai <strong className="text-ink">{booth.name}</strong>, bilik{" "}
            <strong className="text-ink">{SIDE_LABEL[booth.side].toLowerCase()}</strong>, dan siap dipakai memilih.
          </p>
          <p className="mt-2 text-muted">Berlaku sampai pukul 23.59 WIB hari ini. Aktifkan lagi pada hari pemilihan berikutnya.</p>
          <Link href="/" className="mt-6 block rounded-lg bg-brand py-3.5 text-center text-lg font-semibold text-white hover:bg-brand-dark">
            Buka halaman pemilih
          </Link>
        </section>
      ) : (
        <BoothSetup />
      )}
    </main>
  );
}
