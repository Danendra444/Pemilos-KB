-- =====================================================================
-- Tambahan: buka/tutup pemungutan suara per kategori (SMP dan SMA memilih
-- di hari yang berbeda). Untuk database yang sudah berjalan.
-- Aman dijalankan ulang; tidak menghapus token, suara, atau akun.
-- (schema.sql sudah menyertakan ini untuk instalasi baru.)
--
-- PENTING: jalankan tepat sebelum deploy kode baru, saat pemungutan suara
-- tertutup. Setelah file ini, cast_vote hanya membaca kolom per kategori;
-- tombol buka/tutup kode lama tidak lagi berpengaruh.
-- =====================================================================

alter table settings add column if not exists voting_open_smp_putra boolean not null default false;
alter table settings add column if not exists voting_open_sma_putra boolean not null default false;
alter table settings add column if not exists voting_open_smp_putri boolean not null default false;
alter table settings add column if not exists voting_open_sma_putri boolean not null default false;

-- Status per sisi dipindahkan ke kedua kategori sisinya, lalu dinolkan agar
-- menjalankan ulang tidak membuka apa pun. Kolom lama tidak dipakai lagi.
update settings
   set voting_open_smp_putra = voting_open_smp_putra or voting_open_putra,
       voting_open_sma_putra = voting_open_sma_putra or voting_open_putra,
       voting_open_smp_putri = voting_open_smp_putri or voting_open_putri,
       voting_open_sma_putri = voting_open_sma_putri or voting_open_putri,
       voting_open_putra = false,
       voting_open_putri = false
 where id = 1;

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
     set voting_open_putra = false, voting_open_putri = false,
         voting_open_smp_putra = false, voting_open_sma_putra = false,
         voting_open_smp_putri = false, voting_open_sma_putri = false,
         results_published = false
   where id = 1;
  delete from tokens where true;
  update vote_counts set count = 0 where true;
  delete from rate_limits where true;
end;
$$;

revoke all on function cast_vote(text, int, text) from public, anon, authenticated;
grant execute on function cast_vote(text, int, text) to service_role;
