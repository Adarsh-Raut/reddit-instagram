"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
    return { message: "Too many attempts. Try again in 15 minutes." };
  }

  const password = String(formData.get("password") ?? "");
  if (!verifyPassword(password, process.env.ADMIN_PASSWORD_HASH)) {
    loginThrottle.recordFailure(key);
    return { message: "Wrong password." };
  }

  loginThrottle.reset(key);
  await startSession();
  redirect("/"); // always the dashboard, never a user-supplied URL
}

export async function logout() {
  await endSession();
  redirect("/login");
}
