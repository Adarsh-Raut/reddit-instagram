import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/instagram/api";
import { getIgConfig } from "@/lib/instagram/config";
import { newOAuthState } from "@/lib/instagram/publish";

export async function GET(request: Request) {
  const cfg = getIgConfig();
  if (!cfg) return NextResponse.redirect(new URL("/settings?ig=not-configured", request.url));

  const state = newOAuthState();
  (await cookies()).set("ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/instagram",
  });
  return NextResponse.redirect(buildAuthUrl(cfg, state));
}
