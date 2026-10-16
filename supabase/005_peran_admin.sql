-- =====================================================================
-- Tambahan: peran admin (master, putra, putri) dan pemungutan suara per sisi
-- (untuk database yang sudah berjalan).
-- Aman dijalankan ulang; tidak menghapus token, suara, atau akun bilik.
-- (schema.sql sudah menyertakan ini untuk instalasi baru.)
--
-- PENTING: jalankan tepat sebelum deploy kode baru, saat pemungutan suara
-- tertutup. cast_vote dua parameter dihapus; kode lama tidak bisa mencatat suara.
-- =====================================================================

-- Akun panitia putra dan putri (master memakai env ADMIN_USERNAME/ADMIN_PASSWORD).
create table if not exists admin_accounts (
  id uuid primary key default gen_random_uuid(),
  role text not null unique check (role in ('PUTRA', 'PUTRI')),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Satu sesi aktif per peran: login di perangkat lain menonaktifkan perangkat lama.
create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('MASTER', 'PUTRA', 'PUTRI')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists admin_sessions_one_active_per_role on admin_sessions (role) where active;

-- Buka/tutup per sisi. Kolom voting_open lama tidak dipakai lagi; nilainya
-- dipindahkan sekali lalu dinolkan agar menjalankan ulang tidak membuka apa pun.
-- voting_open ditambahkan jika belum ada (database dari schema.sql baru) agar file ini tetap bisa dijalankan.
alter table settings add column if not exists voting_open boolean not null default false;
alter table settings add column if not exists voting_open_putra boolean not null default false;
alter table settings add column if not exists voting_open_putri boolean not null default false;
alter table settings add column if not exists results_published boolean not null default false;
update settings
   set voting_open_putra = voting_open_putra or voting_open,
       voting_open_putri = voting_open_putri or voting_open,
       voting_open = false
 where id = 1;

-- Sisi bilik. Akun lama tanpa sisi tidak bisa dipakai sampai dibuat ulang.
alter table booth_accounts add column if not exists side text check (side in ('PUTRA', 'PUTRI'));

-- cast_vote kini tahu sisi bilik.
drop function if exists cast_vote(text, int);

create or replace function cast_vote(p_token text, p_candidate_id int, p_side text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_open boolean;
  v_cand_category text;
  v_used boolean;
  v_tok_category text;
begin
  select category into v_cand_category from candidates where id = p_candidate_id;
  if v_cand_category is null then
    return 'INVALID_CANDIDATE';
  end if;

  -- Bilik putra hanya mencatat suara kategori putra, dan sebaliknya.
  if p_side is null or split_part(v_cand_category, '_', 2) <> p_side then
    return 'WRONG_BOOTH';
  end if;

  -- FOR SHARE: penutupan pemungutan suara menunggu suara yang sedang diproses.
  select case when p_side = 'PUTRA' then voting_open_putra else voting_open_putri end
    into v_open
    from settings where id = 1 for share;
  if not coalesce(v_open, false) then
    return 'VOTING_CLOSED';
  end if;

  update tokens
     set used = true
   where code = p_token
     and not used
     and category = v_cand_category;

  if not found then
    select used, category into v_used, v_tok_category from tokens where code = p_token;
    if v_tok_category is null then
      return 'TOKEN_INVALID';
    elsif split_part(v_tok_category, '_', 2) <> p_side then
      -- Token sisi lain: jangan beri tahu apakah sudah dipakai.
      return 'WRONG_BOOTH';
    elsif v_used then
      return 'TOKEN_USED';
    else
      return 'CATEGORY_MISMATCH';
    end if;
  end if;

  update vote_counts set count = count + 1 where candidate_id = p_candidate_id;
  if not found then
    raise exception 'vote_counts row missing for candidate %', p_candidate_id;
  end if;

  return 'OK';
end;
$$;

create or replace function reset_election()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update settings
     set voting_open = false, voting_open_putra = false, voting_open_putri = false, results_published = false
   where id = 1;
  delete from tokens where true;
  update vote_counts set count = 0 where true;
  delete from rate_limits where true;
end;
$$;

alter table admin_accounts enable row level security;
alter table admin_sessions enable row level security;
revoke all on admin_accounts, admin_sessions from anon, authenticated;
grant select, insert, update, delete on admin_accounts, admin_sessions to service_role;

revoke all on function cast_vote(text, int, text) from public, anon, authenticated;
grant execute on function cast_vote(text, int, text) to service_role;
