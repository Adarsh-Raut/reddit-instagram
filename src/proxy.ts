import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/lib/auth/access";
import { SESSION_COOKIE } from "@/lib/auth/token";

/**
 * Optimistic gate: sends anyone without a valid session to /login before the
 * request reaches a page. Server actions, route handlers and data components
 * re-check with requireAdmin(), which is the real authorization.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (decideAccess(request.nextUrl.pathname, token, process.env.SESSION_SECRET) === "allow") {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
