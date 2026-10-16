import { currentBooth } from "@/lib/booth";
import VotingBooth from "./voting-booth";

export default async function Home() {
  const booth = await currentBooth();
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-12 short:py-5">
      {booth ? (
        <VotingBooth />
      ) : (
        // Sengaja tanpa tautan ke /bilik agar pemilih tidak menemukan halaman aktivasi.
        <section className="w-full max-w-md rounded-xl border border-line bg-white p-6 text-center sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
            <svg viewBox="0 0 24 24" className="h-7 w-7 text-brand" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Halaman ini tidak dapat diakses</h1>
          <p className="mt-2 text-muted">
            Pemilihan Ketua &amp; Wakil Ketua OSIS hanya dapat dilakukan di bilik resmi yang disediakan panitia. Silakan datang ke bilik pemilihan
            dan bawa kertas tokenmu.
          </p>
        </section>
      )}
    </main>
  );
}
