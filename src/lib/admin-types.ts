import type { Category } from "./categories";
import type { AdminRole, Side } from "./sides";

export type ClassStat = { class_name: string; category: string; total: number; used: number };

export type ResultRow = {
  candidate_id: number;
  category: string;
  number: number;
  name: string;
  is_blank: boolean;
  votes: number;
};

export type BoothRow = { id: string; name: string; created_at: string };

/** Akun bilik beserta perangkat yang sedang aktif (jika ada). side null: akun lama tanpa sisi. */
export type BoothAccountRow = { id: string; name: string; side: Side | null; device: BoothRow | null };

export type AdminAccountRow = { role: Side; username: string };

export type VotingStatus = { category: Category; open: boolean };

export type Overview = {
  role: AdminRole;
  /** Status buka/tutup untuk kategori yang boleh dilihat peran ini. */
  voting: VotingStatus[];
  resultsPublished: boolean;
  /** Akun bilik sisi yang terlihat; device terisi jika akun sedang aktif di sebuah perangkat. */
  accounts: BoothAccountRow[];
  /** Nama bilik jika perangkat yang membuka panel ini adalah bilik sisi yang terlihat. */
  thisBooth: string | null;
  classes: ClassStat[];
  /** Hanya kategori yang hasilnya boleh dilihat (lihat resultCategories); null jika tidak ada. */
  results: ResultRow[] | null;
  /** Tautan bilik online guru (path) untuk sisi yang terlihat. */
  onlineLinks: { side: Side; path: string }[];
  /** Hanya untuk master. */
  adminAccounts: AdminAccountRow[] | null;
};
