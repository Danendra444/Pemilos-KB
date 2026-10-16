# Pemilihan Ketua OSIS

> Panitia angkatan baru: mulai dari [`PANDUAN-ANGKATAN-BARU.md`](PANDUAN-ANGKATAN-BARU.md).

Online voting for the OSIS student council election. Built with Next.js (App Router) on Vercel and Supabase Postgres. All website text is in Bahasa Indonesia.

- **`/`**: voting page. The student enters their token, picks a candidate pair, confirms, sees "Suaramu tercatat", and the page returns to the start after 5 seconds.
- **`/osisgod`**: committee panel with three roles. **Master** (login from `ADMIN_USERNAME`/`ADMIN_PASSWORD`) creates tokens, booth accounts and the putra/putri committee logins, opens/closes voting for each of the four categories, announces results, and resets. **Panitia Putra** and **Panitia Putri** only see their own side: open/close its SMP and SMA voting, see who has voted, print and replace slips, and revoke their booths. Each role can be logged in on one device at a time.

## How the guarantees are enforced

| Rule | Where |
|---|---|
| A token works only once, even with simultaneous submits | `cast_vote(token, candidate, side)` in [`supabase/schema.sql`](supabase/schema.sql) runs one `UPDATE tokens SET used = true WHERE code = … AND NOT used`. Postgres row locking makes a concurrent second call re-check `NOT used` and match zero rows. The vote-count increment runs in the same function, so it's one transaction. (Tested: 50 concurrent submits of one token → 1 `OK`, 49 `TOKEN_USED`, 1 vote counted.) |
| A booth can only cast votes for its own side | `cast_vote` takes the booth's side and rejects a token or candidate from the other side with `WRONG_BOOTH`, before checking whether the token was already used. |
| Votes are secret | `tokens` has only `used` (no candidate, no time of use). `vote_counts` has only totals. A category's results are hidden from everyone, including master, while that category is open, so nobody can watch live counts and match a vote to the student who just voted. Side committees also wait until master clicks **Umumkan hasil**. Don't reopen a category for a single late voter: comparing counts before and after would reveal that student's choice. |
| Browser never touches Supabase | The Supabase key exists only in server env vars (no `NEXT_PUBLIC_`). Every table has RLS on with no policies, and `anon`/`authenticated` have all privileges revoked, so the public anon key can do nothing. |
| Token guessing | Tokens are 6 characters from a 31-symbol alphabet (no `0 O 1 I L`), generated with `crypto.randomInt`. Failed token attempts are limited to 30 per IP per 10 minutes. Only failures count, so a whole school behind one IP isn't blocked. Admin login is limited to 10 failures per 15 minutes. |

Candidates are seeded in `schema.sql`. SMP Putra and SMA Putri each have one pair, so they also get **Kotak Kosong**.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com). Pick a region close to you (e.g. Singapore).
2. Open **SQL Editor → New query**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
   > ⚠️ The script drops and recreates the tables. Run it only on a fresh project, never after real voting has started.

   For a database created earlier, run the files in `supabase/` numbered `002`–`007` that you have not run yet, in order. **`005_peran_admin.sql` must be run right before deploying the matching code, while voting is closed:** it replaces `cast_vote`, so the old code can no longer record votes. Booth accounts created before `005` have no side and must be deleted and recreated. **`007_buka_per_jenjang.sql` is the same:** run it right before deploying the matching code, while voting is closed; afterwards only the per-category open/close buttons of the new code take effect.
3. Go to **Project Settings → API** (or **API Keys**) and copy:
   - the **Project URL**, which becomes `SUPABASE_URL`
   - the **service_role** key (legacy) or a **Secret key** (`sb_secret_…`), which becomes `SUPABASE_SERVICE_ROLE_KEY`

   You don't need the anon/publishable key; the app never uses it.

To change candidates later, edit the `insert into candidates` block before running the script, or update the `candidates` table in the Table Editor. Every candidate needs a matching `vote_counts` row.

## 2. Run locally

Requires Node.js 20.9+.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Project URL from step 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key from step 1 |
| `ADMIN_USERNAME` | Master username for `/osisgod`. Don't change it later to a name already used by a committee login; that login would stop working. |
| `ADMIN_PASSWORD` | Password for `/osisgod`. Make it long. |
| `ADMIN_SESSION_SECRET` | Random string, at least 32 characters. Generate one with `openssl rand -hex 32`. |

```bash
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/osisgod.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository. `.env.local` is gitignored; never commit keys.
2. In [vercel.com](https://vercel.com): **Add New → Project**, import the repo. The framework is detected as Next.js; keep the defaults.
3. Under **Environment Variables**, add the same five variables as `.env.local` (Production environment).
4. Click **Deploy**. If you change env vars later, redeploy for them to take effect.
5. Optional: add a short custom domain under **Settings → Domains**. Booth laptops must be activated at `/bilik` on the final domain.

## 4. Running the election

**Trial run (before election day)**
1. Log in at `/osisgod` and in **Buat token** pick one of the four trial classes (**Uji Coba SMP Putra**, **Uji Coba SMA Putra**, **Uji Coba SMP Putri**, **Uji Coba SMA Putri**) and paste a few names. Print them with **Cetak** like any class. Activate a booth laptop at `/bilik`, open voting, and vote with the trial tokens on that laptop. Also check that a phone that is not a booth is refused. Never use a real student's token during the trial.
2. Close voting in every category and check that the results match.
3. Click **Hapus data uji coba**. It deletes every token in the trial classes and sets every count back to 0; the students' tokens stay. It refuses while any category is open or once any token outside the trial classes has been used, because counts are not linked to tokens and can only be zeroed all at once. **Reset pemilihan** instead deletes every token, including printed ones.

**Preparation**
1. Log in as master. Classes are fixed to this year's 26 classes plus the four trial classes (`src/lib/classes.ts`): Cambridge, Harvard (putri) and MIT, Oxford (putra) in grades 7–12, plus Stanford (putra) in grades 10 and 11; grades 7–9 are SMP, 10–12 are SMA, so the category follows from the class name. In **Buat token**, either pick a class and paste its student names, or choose **Seluruh sekolah** and paste the whole school list from Excel (one student per row with a name column and a class column such as `12 MIT`). Rows whose class is not recognised are listed and skipped. Names longer than 25 characters are shortened by dropping words from the end (so each fits on one line of the slip); a single word longer than that is kept whole. Students who already have a token are skipped, so pasting again is safe.
   Teachers vote too: each teacher chooses the SMP and SMA pair on their own side, and counts the same as a student. In **Buat token**, pick **Guru Putra** or **Guru Putri** and paste the teacher names; each teacher gets two tokens, one in **Guru SMP …** and one in **Guru SMA …**. Print both classes and give each teacher both slips.
2. In **Akun panitia**, create the putra and putri committee logins.
3. In **Bilik pemilihan**, create one account per booth laptop and choose its side. A putra booth only accepts putra tokens, and vice versa.
4. In **Token per kelas**, click **Cetak** for each class and print. Cut along the dashed lines and hand each student their slip. The print page only prints tokens that haven't been used yet, so you can safely reprint a class. **Lihat** shows who has and hasn't voted (never what they chose). If a student loses their slip, use **Ganti token**: the old code stops working and **Cetak** next to the name prints the new slip.

For a database created before named tokens existed, run [`supabase/004_nama_siswa.sql`](supabase/004_nama_siswa.sql) once in the SQL Editor. It only adds a column; existing tokens and votes are kept.

**Election day**
1. On each booth laptop, open `/bilik`, sign in with that booth's username and password (created in **Bilik pemilihan** above). The laptop then shows the token screen; each following student only enters a token. Each booth account works on one laptop at a time (activating it elsewhere deactivates the old laptop) and stays active for 24 hours, so repeat this every voting day. **Ganti password** (master only) sets a new password and signs out the laptop using the old one; **Hapus** (master only) deletes the account. Passwords are stored only as hashes and cannot be viewed again after saving. Only booth devices can check tokens or vote, and only for their own side; other devices see "Halaman ini tidak dapat diakses" (with no link to `/bilik`, so students cannot find it). A committee can revoke its own side's booths from `/osisgod`; master can revoke any booth.
2. SMP and SMA vote on different days, so voting opens per category. On the SMP day each committee clicks **Buka pemungutan suara** only for SMP on its side; SMA tokens are then refused with "Pemungutan suara SMA … belum dibuka". On the SMA day, open SMA. Teachers use their SMP token on the SMP day and their SMA token on the SMA day. While a category is open, nobody (master included) sees its vote counts; only turnout is shown.
3. Students go to a booth, enter their token, and vote. A teacher who cannot come to a booth can vote online: in **Bilik pemilihan → Tautan online guru**, copy their side's link and send it to them. Opening it turns their phone or laptop into a booth for the rest of that day (WIB) that accepts only that side's teacher tokens; they still enter their own token. The link stays the same while `ADMIN_SESSION_SECRET` is unchanged; changing that secret is the only way to disable it. If a voter leaves the choice screen alone for 2 minutes, it resets itself.
4. At the end of each day, each committee clicks **Tutup pemungutan suara** for that day's category. Master sees a category's results as soon as it is closed. When all four categories are closed, master clicks **Umumkan hasil**, and each committee then sees its own side's results. Reopening a category cancels the announcement.

**Admin page contents**
- Master: the four categories' status and open/close/announce controls, results of each category once it is closed, token generator, token list per class with print links, committee logins, booth accounts, and Reset (danger zone)
- Panitia Putra / Panitia Putri: their side's SMP and SMA status and open/close buttons, their side's results once announced, token list with print/replace links, and their side's booth accounts

## Privacy notes

- The app never logs request bodies. Keep it that way: `/api/vote` receives a token and a choice together.
- In Supabase, don't turn on statement-level logging (`log_statement = 'all'`) for this database. It would record token/candidate pairs from `cast_vote` calls.
- Only master and that side's committee can see which classes have used how many tokens. Vote counts exist per category only, never per class.

## Project layout

```
supabase/schema.sql            tables, seed candidates, cast_vote() and admin functions, permissions
supabase/002–007*.sql          migrations (006 removed: it only set last year's candidate names) to apply in order to a database created before that change
src/lib/                       server-only helpers (Supabase client, admin session/roles, sides, classes, password hashing, rate limit, token generator)
src/app/page.tsx               voting page (+ voting-booth.tsx)
src/app/osisgod/               admin login, dashboard, dashboard sections (panel/), print page (cetak/)
src/app/api/token/check        check a token without using it
src/app/api/vote               cast a vote (calls cast_vote)
src/app/api/admin/*            login, logout, overview, voting, tokens, booth-accounts, booths/revoke, admin-accounts, results/publish, trial/clear, reset
```
