import { NextResponse } from "next/server";
import { checkBoothAccount, registerThisDevice } from "@/lib/booth";
import { endSession } from "@/lib/admin-auth";
import { isBlocked, recordFailure } from "@/lib/rate-limit";
import { fail, readJson } from "@/lib/http";
import { boothUsername } from "@/lib/booth-username";

// Menjadikan perangkat YANG SEDANG DIPAKAI sebagai bilik dengan akun bilik
// (bukan kata sandi admin), sehingga kata sandi admin tidak pernah diketik di bilik.
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    // Dihitung per username: semua laptop bilik memakai satu IP publik sekolah yang sama.
    const subject = `user:${boothUsername(typeof body?.username === "string" ? body.username : "")}`;
    if (await isBlocked(req, "booth", subject)) {
      return fail(429, "Terlalu banyak percobaan. Tunggu 15 menit lalu coba lagi.");
    }
    const account = await checkBoothAccount(body?.username, body?.password);
    if (!account) {
      await recordFailure(req, "booth", subject);
      return fail(401, "Username atau password salah.");
    }
    if (!account.side) {
      return fail(403, "Akun bilik ini belum diatur untuk putra atau putri. Minta master menghapus dan membuat ulang akun ini.");
    }

    const booth = await registerThisDevice(account);
    // Perangkat ini akan dipakai pemilih; jangan biarkan sesi admin terbuka di sini.
    await endSession();
    return NextResponse.json({ booth });
  } catch (err) {
    console.error("[booth/register]", err instanceof Error ? err.message : JSON.stringify(err));
    return fail(500, "Terjadi kesalahan server. Coba lagi.");
  }
}
