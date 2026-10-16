# Panduan untuk Panitia Angkatan Baru

Repo ini adalah web Pemilihan Ketua OSIS: siswa dan guru memilih dengan token di bilik (laptop/iPad), panitia mengatur semuanya di `/osisgod`. Panduan ini untuk memasang ulang web ini di akun **kalian sendiri**. Penjelasan teknis lengkap (dalam bahasa Inggris) ada di [`README.md`](README.md).

Repo ini tidak berisi password, kunci, data siswa, maupun hasil pemilu angkatan sebelumnya. Nama paslon di `supabase/schema.sql` masih contoh (`Nama Ketua & Nama Wakil`), dan folder `public/calon/` belum berisi foto.

## Yang perlu disiapkan

- Akun GitHub, akun [Supabase](https://supabase.com) (gratis), dan akun [Vercel](https://vercel.com) (gratis, masuk pakai GitHub).
- Node.js versi 20.9 atau lebih baru, kalau ingin menjalankan di laptop sendiri.
- Daftar paslon tiap kategori (SMP Putra, SMP Putri, SMA Putra, SMA Putri), foto paslon, daftar kelas, daftar siswa, dan daftar guru.

## Langkah 1. Buat repo sendiri

1. Buka repo ini di GitHub, klik **Use this template → Create a new repository**.
2. Pilih akun kalian sebagai pemilik, beri nama (mis. `Pemilos-KB-27-28`), pilih **Private**.
3. Clone repo baru itu ke laptop:

```bash
git clone https://github.com/<akun-kalian>/<nama-repo>.git
```

Semua langkah berikutnya dikerjakan di repo baru ini, bukan di repo angkatan sebelumnya.

## Langkah 2. Isi data tahun ini

| Yang diubah | File |
|---|---|
| Nama paslon, jumlah paslon tiap kategori, Kotak Kosong | blok `insert into candidates` di `supabase/schema.sql` |
| Foto paslon | `public/calon/` (aturan nama file ada di `public/calon/README.txt`) |
| Daftar kelas dan sisi putra/putri tiap kelas | `src/lib/classes.ts` |

Aturan paslon:
- `number` adalah nomor urut. Kategori yang hanya punya **satu** pasangan wajib diberi baris `Kotak Kosong` dengan `number` 99 dan `is_blank` `true`. Kategori dengan dua pasangan atau lebih tidak perlu Kotak Kosong.
- Foto: JPG potret 480 × 640, di bawah 50 KB, nama file mis. `sma_putra-1-ketua.jpg`. Kalau foto belum ada, halaman menampilkan siluet abu-abu.

## Langkah 3. Siapkan database Supabase

1. Di Supabase, buat project baru. Pilih region **Singapore**. Simpan password database di tempat aman.
2. Buka **SQL Editor → New query**, tempel seluruh isi `supabase/schema.sql` (yang sudah diisi paslon tahun ini), lalu klik **Run**.
   - File `002`–`007` di folder `supabase/` **tidak perlu** dijalankan. Itu hanya untuk memperbarui database lama; `schema.sql` sudah mencakup semuanya.
   - Jangan jalankan `schema.sql` lagi setelah pemilu dimulai: script ini menghapus dan membuat ulang semua tabel.
3. Buka **Project Settings → API Keys**, salin:
   - **Project URL** → untuk `SUPABASE_URL`
   - **Secret key** (`sb_secret_…`) atau **service_role** key → untuk `SUPABASE_SERVICE_ROLE_KEY`

## Langkah 4. Isi variabel rahasia

Salin contoh file env:

```bash
cp .env.example .env.local
```

Isi `.env.local`:

| Variabel | Isi |
|---|---|
| `SUPABASE_URL` | Project URL dari langkah 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key dari langkah 3 |
| `ADMIN_USERNAME` | Username master untuk `/osisgod` |
| `ADMIN_PASSWORD` | Password master. Buat yang panjang. |
| `ADMIN_SESSION_SECRET` | Teks acak minimal 32 karakter. Buat dengan `openssl rand -hex 32` |
| `DEMO_BOOTH_KEY` | Opsional, untuk bilik demo. Kosongkan kalau tidak dipakai. |

**Jangan pernah commit `.env.local`** dan jangan kirim isinya lewat grup chat. File ini sudah otomatis diabaikan git.

## Langkah 5. Coba di laptop

```bash
npm install
```

```bash
npm test
```

```bash
npm run dev
```

Buka http://localhost:3000 (halaman memilih) dan http://localhost:3000/osisgod (panel panitia).

## Langkah 6. Deploy ke Vercel

1. Di Vercel: **Add New → Project**, pilih repo kalian. Biarkan pengaturan bawaan (Next.js).
2. Di **Environment Variables**, masukkan kelima atau keenam variabel yang sama dengan `.env.local`.
3. Klik **Deploy**. Kalau nanti variabel diubah, klik **Redeploy** supaya berlaku.
4. Setiap kali kalian push ke branch `main`, Vercel otomatis deploy ulang.

## Langkah 7. Jalankan pemilu

Urutan lengkapnya ada di [`README.md`](README.md) bagian **4. Running the election**. Ringkasnya:

1. **Uji coba:** buat token di kelas `Uji Coba …`, aktifkan satu bilik di `/bilik`, buka pemungutan suara, coba memilih, tutup, lalu klik **Hapus data uji coba**.
2. **Persiapan:** buat token per kelas (tempel daftar siswa), token guru, akun panitia putra/putri, akun bilik, lalu cetak slip token.
3. **Hari pemilihan:** aktifkan tiap bilik di `/bilik`, buka kategori yang dijadwalkan hari itu, tutup di akhir hari.
4. **Umumkan:** setelah keempat kategori ditutup, master klik **Umumkan hasil**.

## Menjaga kerahasiaan

- Hasil suara hanya ada di database Supabase kalian. Jangan memotret atau membagikan halaman hasil sebelum diumumkan resmi.
- Jangan membuka lagi kategori yang sudah ditutup hanya untuk satu pemilih yang terlambat: selisih hasil sebelum dan sesudah bisa membuka pilihan orang itu.
- Jangan commit daftar siswa, token, laporan, atau hasil pemilu ke repo. Simpan di luar folder repo.
- Setelah pemilu selesai, kalau repo akan diwariskan lagi ke angkatan berikutnya: kembalikan nama paslon di `schema.sql` ke contoh dan hapus foto di `public/calon/` sebelum menyerahkan.

