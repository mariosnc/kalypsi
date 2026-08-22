import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("kalypsi_session")?.value;
  const { pathname } = req.nextUrl;

  let payload: any = null;
  if (token) {
    try {
      const verified = await jwtVerify(token, SECRET);
      payload = verified.payload;
    } catch {
      payload = null;
    }
  }

  if (!payload) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname.startsWith("/admin") && payload.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};
