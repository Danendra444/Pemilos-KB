-- =====================================================================
-- Tambahan: token bernama per siswa (untuk database yang sudah berjalan).
-- Aman dijalankan ulang; tidak menghapus token, suara, atau data lain.
-- (schema.sql sudah menyertakan ini untuk instalasi baru.)
--
-- Nama hanya menandai siapa yang sudah memakai tokennya. Tetap tidak ada
-- kolom kandidat maupun waktu pemakaian, jadi pilihan siswa tetap rahasia.
-- Token lama tanpa nama tetap berlaku.
-- =====================================================================

alter table tokens add column if not exists student_name text check (length(student_name) between 1 and 80);

-- Satu siswa = satu token per kelas (huruf besar/kecil dianggap sama).
create unique index if not exists tokens_student_idx on tokens (class_name, lower(student_name)) where student_name is not null;
