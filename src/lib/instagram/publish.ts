import { randomBytes } from "node:crypto";
import {
  claimForPublishing,
  getIgAccount,
  markFailed,
  markPosted,
  type IgAccount,
  type PublishClaim,
} from "@/db/queries";
import { instagramReadyUrl } from "@/lib/cloudinary";
import { decrypt } from "@/lib/crypto";
import { buildCaption, publishImage } from "./api";
import { getIgConfig } from "./config";

export type PublishDeps = {
  claim: (id: string) => Promise<PublishClaim | null>;
  getAccount: () => Promise<IgAccount | null>;
  markPosted: (scheduleId: string, postId: string, mediaId: string) => Promise<void>;
  markFailed: (scheduleId: string, error: string) => Promise<void>;
  decryptToken: (encrypted: string) => string;
  imageUrl: (publicId: string) => string;
  publish: (args: { igUserId: string; token: string; imageUrl: string; caption: string }) => Promise<string>;
  now: () => Date;
};

export type PublishResult = { ok: true; mediaId: string } | { ok: false; message: string };

const realDeps = (): PublishDeps => ({
  claim: claimForPublishing,
  getAccount: getIgAccount,
  markPosted,
  markFailed,
  decryptToken: decrypt,
  imageUrl: instagramReadyUrl,
  publish: (args) => publishImage({ apiVersion: getIgConfig()?.apiVersion }, args),
  now: () => new Date(),
});

/**
 * Publish one scheduled post to Instagram. Safe to call twice: only the first
 * caller can claim a pending/failed row, so a post is never published twice.
 */
export async function publishScheduledPost(
  scheduleId: string,
  deps: PublishDeps = realDeps(),
): Promise<PublishResult> {
  const claim = await deps.claim(scheduleId);
  if (!claim) return { ok: false, message: "Already publishing or posted." };

  const fail = async (message: string): Promise<PublishResult> => {
    await deps.markFailed(scheduleId, message);
    return { ok: false, message };
  };

  try {
    const account = await deps.getAccount();
    if (!account) return await fail("Instagram isn’t connected. Connect it in Settings.");
    if (account.tokenExpiresAt <= deps.now()) {
      return await fail("The Instagram token has expired. Reconnect in Settings.");
    }
    const mediaId = await deps.publish({
      igUserId: account.igUserId,
      token: deps.decryptToken(account.encryptedToken),
      imageUrl: deps.imageUrl(claim.post.cloudinaryPublicId),
      caption: claim.caption || buildCaption(claim.post),
    });
    try {
      await deps.markPosted(scheduleId, claim.postId, mediaId);
    } catch (e) {
      // Instagram has the post; never leave it publishable again.
      console.error(`Published ${mediaId} but failed to record it for ${scheduleId}`, e);
    }
    return { ok: true, mediaId };
  } catch (e) {
    return await fail(e instanceof Error ? e.message : "Publishing failed");
  }
}

export function newOAuthState() {
  return randomBytes(16).toString("hex");
}
