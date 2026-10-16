import { NextResponse, type NextRequest } from "next/server";
import { boothExpiry, checkOnlineKey, ONLINE_BOOTH_COOKIE, onlineBoothCookie } from "@/lib/booth";
import { isSide } from "@/lib/sides";

// Tautan bilik online guru: /online/putra/<kunci> atau /online/putri/<kunci> menjadikan perangkat ini
// bilik yang hanya menerima token guru sisi itu, tanpa akun bilik. Kunci salah tampak seperti halaman yang tidak ada.
export async function GET(req: NextRequest, ctx: RouteContext<"/online/[side]/[key]">) {
  const { side: rawSide, key } = await ctx.params;
  const side = rawSide.toUpperCase();
  if (!isSide(side) || !checkOnlineKey(side, key)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const expiry = boothExpiry();
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(ONLINE_BOOTH_COOKIE, onlineBoothCookie(side, expiry), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(1, expiry - Math.floor(Date.now() / 1000)),
  });
  return res;
}
