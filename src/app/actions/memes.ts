"use server";

import { revalidatePath } from "next/cache";
import { hashExists, insertScrapedPost } from "@/db/queries";
import { recordActivity } from "@/lib/activity";
import { requireAdmin } from "@/lib/auth/session";
import { uploadRemoteImage } from "@/lib/cloudinary";
import { getLogger } from "@/lib/log";
import { addManualMeme } from "@/lib/memes/manual";
import { autoScheduleIfEnabled } from "@/lib/schedule/service";

const log = getLogger("actions");

export type AddMemeState = { ok: boolean; message: string } | null;

/** Upload an image from the dashboard. It joins the Approved list (and is auto-scheduled if enabled). */
export async function addMeme(_prev: AddMemeState, formData: FormData): Promise<AddMemeState> {
  await requireAdmin();
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image file." };

  try {
    const result = await addManualMeme(
      { bytes: Buffer.from(await file.arrayBuffer()), title: String(formData.get("title") ?? "") },
      { hashExists, upload: uploadRemoteImage, insert: insertScrapedPost },
    );
    if (!result.ok) return result;

    await recordActivity({ level: "info", kind: "meme.added", message: "Uploaded a meme manually", meta: { id: result.id } });
    let note = "";
    try {
      const scheduled = await autoScheduleIfEnabled();
      if (scheduled?.ok) note = " and scheduled it";
    } catch (e) {
      log.error({ err: e }, "auto-schedule after upload failed"); // it stays approved; schedule manually
    }
    revalidatePath("/", "layout");
    return { ok: true, message: `Added to Approved${note}.` };
  } catch (e) {
    log.error({ err: e }, "addMeme failed");
    return { ok: false, message: `Couldn’t add the meme: ${e instanceof Error ? e.message : "unknown error"}` };
  }
}
