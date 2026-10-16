import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./token";

export function authConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD_HASH) && (process.env.SESSION_SECRET?.length ?? 0) >= 32;
}

export async function startSession() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  (await cookies()).set(SESSION_COOKIE, signSession(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function isAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token, process.env.SESSION_SECRET);
}

/**
 * Call at the top of every server action, route handler and data-reading page
 * component. The proxy is only an optimistic first check; this is the real gate.
 * Never call inside a try/catch: redirect() works by throwing.
 */
export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/login");
}
