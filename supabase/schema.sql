-- =====================================================================
-- Pemilihan Ketua OSIS — skema database
-- Jalankan seluruh file ini sekali di Supabase SQL Editor.
-- Aman dijalankan ulang di database kosong; TIDAK untuk dijalankan ulang
-- setelah pemilihan berjalan (akan menghapus data).
-- =====================================================================

drop function if exists cast_vote(text, int);
drop function if exists cast_vote(text, int, text);
drop function if exists token_stats();
drop function if exists election_results();
drop function if exists reset_election();
drop function if exists rate_limit_blocked(text, int, int);
drop function if exists rate_limit_fail(text, int);
drop table if exists vote_counts, tokens, candidates, settings, rate_limits, booths, booth_accounts, admin_accounts, admin_sessions cascade;

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------

-- Pemungutan suara dibuka/ditutup per kategori (SMP dan SMA memilih di hari
-- yang berbeda). Hasil untuk panitia putra/putri baru terlihat setelah master
-- mengumumkannya.
create table settings (
  id int primary key default 1 check (id = 1),
  voting_open_smp_putra boolean not null default false,
  voting_open_sma_putra boolean not null default false,
  voting_open_smp_putri boolean not null default false,
  voting_open_sma_putri boolean not null default false,
  results_published boolean not null default false
);
insert into settings (id) values (1);

create table candidates (
  id serial primary key,
  category text not null check (category in ('SMP_PUTRA', 'SMP_PUTRI', 'SMA_PUTRA', 'SMA_PUTRI')),
  number int not null,          -- nomor urut; Kotak Kosong memakai 99
  name text not null,
  is_blank boolean not null default false,
  unique (category, number)
);

-- Hanya jumlah suara. Tidak ada kolom yang menghubungkan suara ke token.
create table vote_counts (
  candidate_id int primary key references candidates (id) on delete cascade,
  count int not null default 0 check (count >= 0)
);

-- Token sekali pakai. Sengaja TIDAK ada kolom waktu pemakaian dan
-- TIDAK ada kolom kandidat, agar pilihan tidak bisa ditelusuri.
create table tokens (
  code text primary key check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  category text not null check (category in ('SMP_PUTRA', 'SMP_PUTRI', 'SMA_PUTRA', 'SMA_PUTRI')),
  class_name text not null check (length(class_name) between 1 and 40),
  student_name text check (length(student_name) between 1 and 80),
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index tokens_class_idx on tokens (class_name);
-- Satu siswa = satu token per kelas. Nama boleh kosong (token anonim).
create unique index tokens_student_idx on tokens (class_name, lower(student_name)) where student_name is not null;

-- Akun bilik: satu kata sandi per bilik (hash scrypt). Satu akun = satu perangkat aktif.
create table booth_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 1 and 40),
  password_hash text not null,
  side text check (side in ('PUTRA', 'PUTRI')),
  created_at timestamptz not null default now()
);

-- Akun panitia putra dan putri (master memakai env ADMIN_USERNAME/ADMIN_PASSWORD).
create table admin_accounts (
  id uuid primary key default gen_random_uuid(),
  role text not null unique check (role in ('PUTRA', 'PUTRI')),
  username text not null unique check (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Satu sesi aktif per peran: login di perangkat lain menonaktifkan perangkat lama.
create table admin_sessions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('MASTER', 'PUTRA', 'PUTRI')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index admin_sessions_one_active_per_role on admin_sessions (role) where active;

-- Perangkat bilik resmi. Hanya perangkat terdaftar yang bisa memilih.
-- Tidak dihapus oleh reset_election(): bilik adalah pengaturan fisik.
create table booths (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 40),
  account_id uuid references booth_accounts (id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index booths_one_active_per_account on booths (account_id) where active;

-- Pembatas percobaan token/password yang salah (kunci = hash IP).
create table rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  failures int not null default 0
);

-- ---------------------------------------------------------------------
-- Data kandidat
-- ---------------------------------------------------------------------

insert into candidates (category, number, name, is_blank) values
  ('SMP_PUTRA', 1,  'Nama Ketua & Nama Wakil', false),
  ('SMP_PUTRA', 99, 'Kotak Kosong',            true),
  ('SMP_PUTRI', 1,  'Nama Ketua & Nama Wakil', false),
  ('SMP_PUTRI', 2,  'Nama Ketua & Nama Wakil', false),
  ('SMA_PUTRI', 1,  'Nama Ketua & Nama Wakil', false),
  ('SMA_PUTRI', 99, 'Kotak Kosong',            true),
  ('SMA_PUTRA', 1,  'Nama Ketua & Nama Wakil', false),
  ('SMA_PUTRA', 2,  'Nama Ketua & Nama Wakil', false);

insert into vote_counts (candidate_id, count) select id, 0 from candidates;

-- ---------------------------------------------------------------------
-- cast_vote: satu fungsi = satu transaksi.
--
-- Token dipakai dengan satu UPDATE ... WHERE NOT used. Jika dua orang
-- mengirim token yang sama bersamaan, UPDATE kedua menunggu kunci baris,
-- lalu mengevaluasi ulang "NOT used" (sudah true) dan tidak mengubah
-- apa pun. Hanya satu yang berhasil menambah suara.
-- Bilik membawa sisinya (p_side); suara hanya dicatat untuk kategori sisi itu,
-- dan hanya jika kategori calon sedang dibuka.
-- ---------------------------------------------------------------------

create function cast_vote(p_token text, p_candidate_id int, p_side text)
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
  select case v_cand_category
           when 'SMP_PUTRA' then voting_open_smp_putra
           when 'SMA_PUTRA' then voting_open_sma_putra
           when 'SMP_PUTRI' then voting_open_smp_putri
           when 'SMA_PUTRI' then voting_open_sma_putri
         end
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
    -- Tidak ada yang berubah; cari tahu alasannya untuk pesan kesalahan.
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
    -- Membatalkan seluruh transaksi, termasuk pemakaian token.
    raise exception 'vote_counts row missing for candidate %', p_candidate_id;
  end if;

  return 'OK';
end;
$$;

-- ---------------------------------------------------------------------
-- Fungsi admin
-- ---------------------------------------------------------------------

create function token_stats()
returns table (class_name text, category text, total bigint, used bigint)
language sql
security definer
set search_path = public
as $$
  select class_name, category, count(*), count(*) filter (where used)
    from tokens
   group by class_name, category
   order by category, class_name;
$$;

create function election_results()
returns table (candidate_id int, category text, number int, name text, is_blank boolean, votes int)
language sql
security definer
set search_path = public
as $$
  select c.id, c.category, c.number, c.name, c.is_blank, coalesce(v.count, 0)
    from candidates c
    left join vote_counts v on v.candidate_id = c.id
   order by c.category, c.number;
$$;

create function reset_election()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update settings
     set voting_open_smp_putra = false, voting_open_sma_putra = false,
         voting_open_smp_putri = false, voting_open_sma_putri = false,
         results_published = false
   where id = 1;
  delete from tokens where true;
  update vote_counts set count = 0 where true;
  delete from rate_limits where true;
end;
$$;

-- ---------------------------------------------------------------------
-- Pembatas percobaan gagal
-- ---------------------------------------------------------------------

create function rate_limit_blocked(p_key text, p_max int, p_window_seconds int)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from rate_limits
     where key = p_key
       and failures >= p_max
       and window_start > now() - make_interval(secs => p_window_seconds)
  );
$$;

create function rate_limit_fail(p_key text, p_window_seconds int)
returns void
language sql
security definer
set search_path = public
as $$
  insert into rate_limits as r (key, window_start, failures)
  values (p_key, now(), 1)
  on conflict (key) do update
     set failures = case when r.window_start > now() - make_interval(secs => p_window_seconds)
                         then r.failures + 1 else 1 end,
         window_start = case when r.window_start > now() - make_interval(secs => p_window_seconds)
                             then r.window_start else now() end;
$$;

-- ---------------------------------------------------------------------
-- Keamanan: browser tidak boleh menyentuh apa pun.
-- RLS aktif tanpa policy → anon/authenticated tidak bisa baca/tulis.
-- Hanya service_role (dipakai server Next.js) yang bisa memanggil fungsi.
-- ---------------------------------------------------------------------

alter table settings    enable row level security;
alter table candidates  enable row level security;
alter table vote_counts enable row level security;
alter table tokens      enable row level security;
alter table rate_limits enable row level security;
alter table booths      enable row level security;
alter table booth_accounts enable row level security;
alter table admin_accounts enable row level security;
alter table admin_sessions enable row level security;

revoke all on settings, candidates, vote_counts, tokens, rate_limits, booths, booth_accounts, admin_accounts, admin_sessions from anon, authenticated;
revoke all on sequence candidates_id_seq from anon, authenticated;

-- Supabase versi baru tidak lagi memberi hak tabel secara otomatis; server butuh ini.
grant select, insert, update, delete on settings, candidates, vote_counts, tokens, rate_limits, booths, booth_accounts, admin_accounts, admin_sessions to service_role;
grant usage, select on sequence candidates_id_seq to service_role;

revoke all on function cast_vote(text, int, text)             from public, anon, authenticated;
revoke all on function token_stats()                          from public, anon, authenticated;
revoke all on function election_results()                     from public, anon, authenticated;
revoke all on function reset_election()                       from public, anon, authenticated;
revoke all on function rate_limit_blocked(text, int, int)     from public, anon, authenticated;
revoke all on function rate_limit_fail(text, int)             from public, anon, authenticated;

grant execute on function cast_vote(text, int, text)          to service_role;
grant execute on function token_stats()                       to service_role;
grant execute on function election_results()                  to service_role;
grant execute on function reset_election()                    to service_role;
grant execute on function rate_limit_blocked(text, int, int)  to service_role;
grant execute on function rate_limit_fail(text, int)          to service_role;
