/** Username bilik: huruf kecil, angka, "-" atau "_", 3–30 karakter, mis. "bilik1". */
export const BOOTH_USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,29}$/;
export const BOOTH_PASSWORD_MIN = 6;

/** Username dibandingkan tanpa membedakan huruf besar/kecil dan tanpa spasi. */
export function boothUsername(input: string): string {
  return input.toLowerCase().replace(/\s+/g, "");
}
