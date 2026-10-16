"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import { authConfigured, endSession, startSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { loginThrottle } from "@/lib/auth/throttle";

export type LoginState = { message: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!authConfigured()) {
    return { message: "Login isn’t set up. Run npm run admin:setup and set SESSION_SECRET." };
  }
  const h = await headers();
  const key = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (loginThrottle.isBlocked(key)) {
    await recordActivity({ level: "warn", kind: "auth.blocked", message: "Login blocked: too many failed attempts", meta: { ip: key } });
    return { message: "Too many attempts. Try again in 15 minutes." };
  }

  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password, process.env.ADMIN_PASSWORD_HASH)) {
    loginThrottle.recordFailure(key);
    await recordActivity({ level: "warn", kind: "auth.login_failed", message: "Wrong password on login", meta: { ip: key } });
    return { message: "Wrong password." };
  }

  loginThrottle.reset(key);
  await startSession();
  await recordActivity({ level: "info", kind: "auth.login", message: "Signed in", meta: { ip: key } });
  redirect("/"); // always the dashboard, never a user-supplied URL
}

export async function logout() {
  await endSession();
  await recordActivity({ level: "info", kind: "auth.logout", message: "Signed out" });
  redirect("/login");
}
