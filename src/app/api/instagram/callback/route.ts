import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveIgAccount } from "@/db/queries";
import { recordActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth/session";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, getProfile, toLongLived } from "@/lib/instagram/api";
import { getIgConfig } from "@/lib/instagram/config";

function sameState(a: string | undefined, b: string | null) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const back = (result: string) => {
    const res = NextResponse.redirect(new URL(`/settings?ig=${result}`, request.url));
    res.cookies.delete({ name: "ig_oauth_state", path: "/api/instagram" });
    return res;
  };

  const cfg = getIgConfig();
  if (!cfg) return back("not-configured");

  const expected = (await cookies()).get("ig_oauth_state")?.value;
  if (!sameState(expected, url.searchParams.get("state"))) return back("bad-state");
  if (url.searchParams.get("error")) {
    await recordActivity({ level: "warn", kind: "instagram.denied", message: "Instagram login was cancelled or denied", meta: { reason: url.searchParams.get("error_reason") } });
    return back("denied");
  }
  const code = url.searchParams.get("code");
  if (!code) return back("error");

  try {
    const short = await exchangeCode(cfg, code);
    const long = await toLongLived(cfg, short.accessToken);
    const profile = await getProfile(cfg, long.accessToken);
    await saveIgAccount({
      igUserId: profile.userId,
      username: profile.username,
      encryptedToken: encrypt(long.accessToken),
      tokenExpiresAt: new Date(Date.now() + long.expiresInSeconds * 1000),
    });
    await recordActivity({ level: "info", kind: "instagram.connected", message: `Connected Instagram @${profile.username ?? profile.userId}`, meta: { igUserId: profile.userId } });
    return back("connected");
  } catch (e) {
    await recordActivity({ level: "error", kind: "instagram.connect_failed", message: `Instagram connect failed: ${e instanceof Error ? e.message : String(e)}` });
    return back("error");
  }
}
