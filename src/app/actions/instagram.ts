"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deleteIgAccounts } from "@/db/queries";
import { requireAdmin } from "@/lib/auth/session";
import { publishScheduledPost } from "@/lib/instagram/publish";

export type PublishState = { ok: boolean; message: string } | null;

/** Manually publish one scheduled post to the real Instagram account right now. */
export async function publishNow(_prev: PublishState, formData: FormData): Promise<PublishState> {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Invalid post." };
  const result = await publishScheduledPost(id.data);
  revalidatePath("/", "layout");
  return result.ok
    ? { ok: true, message: "Posted to Instagram." }
    : { ok: false, message: result.message };
}

export async function disconnectInstagram() {
  await requireAdmin();
  await deleteIgAccounts();
  revalidatePath("/settings");
}
