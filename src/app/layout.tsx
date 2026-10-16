import type { Metadata } from "next";
import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pemilihan Ketua OSIS",
  description: "Pemungutan suara Ketua dan Wakil Ketua OSIS",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="no-print border-b border-line bg-white">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <Image src="/logo-osis.png" alt="" width={40} height={40} className="h-10 w-10" priority />
            <div className="leading-tight">
              <p className="font-semibold">OSIS Kharisma Bangsa</p>
              <p className="text-sm text-muted">Pemilihan Ketua &amp; Wakil Ketua OSIS</p>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
