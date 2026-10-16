import { NextResponse, type NextRequest } from "next/server";
import { checkDemoKey, DEMO_BOOTH_COOKIE, DEMO_UNTIL, demoBoothCookie } from "@/lib/booth";
import { isSide } from "@/lib/sides";

// Tautan demo: /demo/<DEMO_BOOTH_KEY>/putra atau /putri menjadikan perangkat ini bilik demo
// tanpa akun bilik. Kunci salah atau masa demo lewat tampak seperti halaman yang tidak ada.
export async function GET(req: NextRequest, ctx: RouteContext<"/demo/[key]/[side]">) {
  const { key, side: rawSide } = await ctx.params;
  const side = rawSide.toUpperCase();
  if (!isSide(side) || !checkDemoKey(key)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(DEMO_BOOTH_COOKIE, demoBoothCookie(side), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: DEMO_UNTIL,
  });
  return res;
}
