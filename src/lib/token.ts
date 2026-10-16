import { randomInt } from "node:crypto";

// Tanpa karakter yang mirip: 0/O, 1/I/L.
export const TOKEN_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TOKEN_LENGTH = 6;
const TOKEN_PATTERN = /^[A-HJKMNP-Z2-9]{6}$/;

export function generateToken(): string {
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)];
  }
  return out;
}

/** Huruf besar, buang spasi/strip. Mengembalikan null jika formatnya salah. */
export function normalizeToken(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return TOKEN_PATTERN.test(code) ? code : null;
}
