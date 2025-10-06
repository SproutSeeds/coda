import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "coda-user";

export function middleware(request: NextRequest) {
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  if (!isDashboardRoute) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(SESSION_COOKIE);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
