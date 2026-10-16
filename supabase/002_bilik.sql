-- =====================================================================
-- Tambahan: perangkat bilik (untuk database yang sudah berjalan).
-- Aman dijalankan pada database yang sudah memakai schema.sql lama;
-- tidak menghapus token, suara, atau data lain.
-- (schema.sql sudah menyertakan tabel ini untuk instalasi baru.)
-- =====================================================================

create table if not exists booths (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table booths enable row level security;
revoke all on booths from anon, authenticated;
grant select, insert, update, delete on booths to service_role;
