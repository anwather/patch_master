import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Check for the next-auth session token cookie
  const token =
    request.cookies.get("__Secure-next-auth.session-token") ||
    request.cookies.get("next-auth.session-token");

  if (!token) {
    const signInUrl = new URL("/", request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
