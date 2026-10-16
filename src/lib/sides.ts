import { CATEGORIES, type Category } from "./categories.ts";

// Pemilihan putra dan putri berjalan terpisah; setiap kategori milik satu sisi.
export const SIDES = ["PUTRA", "PUTRI"] as const;
export type Side = (typeof SIDES)[number];
export type AdminRole = "MASTER" | Side;

export const SIDE_LABEL: Record<Side, string> = { PUTRA: "Putra", PUTRI: "Putri" };

export function isSide(value: unknown): value is Side {
  return value === "PUTRA" || value === "PUTRI";
}

export function sideOf(category: string): Side | null {
  if (category.endsWith("_PUTRA")) return "PUTRA";
  if (category.endsWith("_PUTRI")) return "PUTRI";
  return null;
}

/** Sisi yang boleh dilihat dan diurus sebuah peran. */
export function visibleSides(role: AdminRole): Side[] {
  return role === "MASTER" ? ["PUTRA", "PUTRI"] : [role];
}

export function canManage(role: AdminRole, category: string): boolean {
  const side = sideOf(category);
  return side !== null && visibleSides(role).includes(side);
}

/** Kategori yang boleh dilihat dan dibuka/ditutup sebuah peran. */
export function visibleCategories(role: AdminRole): Category[] {
  return CATEGORIES.filter((c) => canManage(role, c));
}

/**
 * Kategori yang perolehan suaranya boleh dikirim ke peran ini. Kategori yang masih dibuka
 * tidak pernah terlihat (siapa pun), agar suara tidak bisa dicocokkan dengan pemilih.
 * Admin sisi juga menunggu master mengumumkan hasil.
 */
export function resultCategories(role: AdminRole, open: Record<Category, boolean>, published: boolean): Category[] {
  return visibleCategories(role).filter((c) => !open[c] && (role === "MASTER" || published));
}
