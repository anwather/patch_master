import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // next-auth v5 (Auth.js) uses authjs.session-token cookies
  const hasSession = request.cookies.getAll().some(
    (c) =>
      c.name.includes("authjs.session-token") ||
      c.name.includes("next-auth.session-token")
  );

  if (!hasSession) {
    const signInUrl = new URL("/", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
