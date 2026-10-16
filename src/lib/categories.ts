export const CATEGORIES = ["SMP_PUTRA", "SMP_PUTRI", "SMA_PUTRA", "SMA_PUTRI"] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  SMP_PUTRA: "SMP Putra",
  SMP_PUTRI: "SMP Putri",
  SMA_PUTRA: "SMA Putra",
  SMA_PUTRI: "SMA Putri",
};

/** Kolom settings yang menyimpan status buka/tutup sebuah kategori, mis. voting_open_smp_putra. */
export function openColumn(category: Category): string {
  return `voting_open_${category.toLowerCase()}`;
}

/** Status buka/tutup setiap kategori dari satu baris settings. */
export function openState(settings: Record<string, unknown>): Record<Category, boolean> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, settings[openColumn(c)] === true])) as Record<Category, boolean>;
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && (CATEGORIES as readonly string[]).includes(value);
}

export type Candidate = {
  id: number;
  number: number;
  name: string;
  is_blank: boolean;
};

export type Role = "ketua" | "wakil";

/** Foto calon diletakkan di public/calon/, mis. sma_putra-1-ketua.jpg. */
export function candidatePhoto(category: string, number: number, role: Role) {
  return `/calon/${category.toLowerCase()}-${number}-${role}.jpg`;
}

/** Nama pasangan disimpan sebagai "Ketua & Wakil". */
export function splitPair(name: string) {
  const [ketua, wakil = ""] = name.split(/\s*&\s*/);
  return { ketua, wakil };
}
