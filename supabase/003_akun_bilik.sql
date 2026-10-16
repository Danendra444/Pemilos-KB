-- =====================================================================
-- Tambahan: akun per bilik (untuk database yang sudah berjalan).
-- Aman dijalankan ulang; tidak menghapus token, suara, atau data lain.
-- (schema.sql sudah menyertakan ini untuk instalasi baru.)
--
-- Setiap bilik punya kata sandi sendiri (disimpan sebagai hash scrypt).
-- Satu akun hanya aktif di satu perangkat: mengaktifkan akun di perangkat
-- lain otomatis menonaktifkan perangkat sebelumnya.
-- =====================================================================

create table if not exists booth_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 40),
  password_hash text not null,
  created_at timestamptz not null default now()
);

alter table booths add column if not exists account_id uuid references booth_accounts (id) on delete cascade;
create index if not exists booths_account_idx on booths (account_id) where active;

-- Satu akun = satu perangkat aktif, dijamin database (mencegah dua aktivasi bersamaan).
-- Bilik lama tanpa akun dan duplikat yang lebih lama dinonaktifkan dulu.
update booths set active = false where active and account_id is null;
update booths b set active = false
 where b.active
   and exists (select 1 from booths n where n.account_id = b.account_id and n.active and n.created_at > b.created_at);
drop index if exists booths_account_idx;
create unique index if not exists booths_one_active_per_account on booths (account_id) where active;

alter table booth_accounts enable row level security;
revoke all on booth_accounts from anon, authenticated;
grant select, insert, update, delete on booth_accounts to service_role;
