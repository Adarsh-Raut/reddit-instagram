"use client";

import { EyeIcon } from "lucide-react";
import { InstagramPreview } from "@/components/instagram-preview";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/** Read-only "what will Instagram get" panel for an approved meme. */
export function PostPreviewSheet({
  title,
  imageUrl,
  caption,
  username,
}: {
  title: string;
  imageUrl: string | null;
  caption: string;
  username: string | null;
}) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="ghost" size="sm" className="-mr-2 text-primary" />}>
        <EyeIcon data-icon="inline-start" />
        Preview
      </SheetTrigger>
      <SheetContent title="Instagram preview" description={title}>
        <div className="flex-1 overflow-y-auto p-5">
          <InstagramPreview imageUrl={imageUrl} caption={caption} username={username} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
