"use client";

import { Tabs } from "@base-ui/react/tabs";
import { EllipsisIcon, EyeIcon, ImageOffIcon, LoaderCircleIcon, PencilIcon, SendIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { publishNow } from "@/app/actions/instagram";
import { editScheduledPost, unschedulePost, type ActionState } from "@/app/actions/schedule";
import { InstagramPreview } from "@/components/instagram-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { IconButton } from "@/components/ui/tooltip";
import { pickCaption } from "@/lib/instagram/caption";
import { useActionToast } from "@/lib/use-action-toast";
import { useProgrammaticFocus } from "@/lib/use-programmatic-focus";
import { cn } from "@/lib/utils";

export type ScheduleRowData = {
  id: string;
  title: string;
  source: string;
  imageUrl: string | null;
  time: string;
  whenValue: string;
  status: "pending" | "publishing" | "posted" | "failed";
  error: string | null;
  caption: string;
  defaultCaption: string;
  /** The exact image URL Instagram will fetch (null if it can't be built). */
  previewUrl: string | null;
};

type SheetTab = "edit" | "preview";

const STATUS: Record<ScheduleRowData["status"], { label: string; variant: "secondary" | "default" | "success" | "destructive" }> = {
  pending: { label: "Scheduled", variant: "secondary" },
  publishing: { label: "Publishing", variant: "default" },
  posted: { label: "Posted", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

function EditSheet({
  row,
  timezone,
  username,
  tab,
  onTabChange,
  open,
  onOpenChange,
}: {
  row: ScheduleRowData;
  timezone: string;
  username: string | null;
  tab: SheetTab;
  onTabChange: (tab: SheetTab) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(editScheduledPost, null);
  const [caption, setCaption] = useState(row.caption);
  const [whenError, setWhenError] = useState<string | null>(null);
  const focusing = useProgrammaticFocus();
  useActionToast(state?.ok ? state : null);
  useEffect(() => {
    if (state?.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Edit post" description={row.title}>
        <form
          action={action}
          noValidate
          onSubmit={(e) => {
            const when = String(new FormData(e.currentTarget).get("when") ?? "");
            if (!when) {
              e.preventDefault();
              setWhenError("Pick a date and time for this post.");
              focusing.focus(e.currentTarget.elements.namedItem("when") as HTMLElement | null);
            }
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <input type="hidden" name="id" value={row.id} />
          <Tabs.Root value={tab} onValueChange={(v) => onTabChange(v as SheetTab)} className="flex min-h-0 flex-1 flex-col">
            <Tabs.List aria-label="Edit or preview" className="flex gap-1 border-b px-5">
              {(
                [
                  ["edit", "Edit"],
                  ["preview", "Preview"],
                ] as const
              ).map(([value, label]) => (
                <Tabs.Tab
                  key={value}
                  value={value}
                  className="-mb-px flex min-h-10 cursor-pointer items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 data-[active]:border-primary data-[active]:text-foreground max-md:min-h-11"
                >
                  {label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            <Tabs.Panel value="edit" keepMounted className="flex-1 space-y-5 overflow-y-auto p-5">
            <Field
              label="Caption"
              optional
              hint={
                <>
                  Leave empty to post the default, which credits the original creator. Add your own hashtags here.{" "}
                  <span className="tabular-nums">{caption.length}/2200</span>
                </>
              }
            >
              {(a11y) => (
                <Textarea
                  {...a11y}
                  name="caption"
                  rows={7}
                  maxLength={2200}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={row.defaultCaption}
                />
              )}
            </Field>
            <Field label={`Post at (${timezone})`} error={whenError}>
              {(a11y) => (
                <Input
                  {...a11y}
                  type="datetime-local"
                  name="when"
                  defaultValue={row.whenValue}
                  onFocus={() => !focusing.isProgrammatic() && setWhenError(null)}
                />
              )}
            </Field>
            </Tabs.Panel>
            <Tabs.Panel value="preview" className="flex-1 overflow-y-auto p-5">
              <InstagramPreview imageUrl={row.previewUrl} caption={pickCaption(caption, row.defaultCaption)} username={username} />
            </Tabs.Panel>
          </Tabs.Root>
          {state && !state.ok && (
            <p role="alert" className="border-t px-5 py-3 text-sm text-destructive">
              {state.message}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t p-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ScheduleRow({ row, timezone, username }: { row: ScheduleRowData; timezone: string; username: string | null }) {
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<SheetTab>("edit");
  const openSheet = (next: SheetTab) => {
    setTab(next);
    setEditing(true);
  };
  const [publishing, startPublish] = useTransition();
  const [removing, startRemove] = useTransition();
  const editable = row.status === "pending" || row.status === "failed";
  const status = STATUS[row.status];

  function publish() {
    startPublish(async () => {
      const fd = new FormData();
      fd.set("id", row.id);
      try {
        const result = await publishNow(null, fd);
        if (result?.ok) toast.success("Posted to Instagram.");
        else toast.error(result?.message ?? "Instagram didn’t accept the post. Try again.");
      } catch {
        toast.error("We couldn’t reach Instagram. Check your connection and try again.");
      }
    });
  }

  function unschedule() {
    startRemove(async () => {
      const fd = new FormData();
      fd.set("id", row.id);
      try {
        await unschedulePost(fd);
        toast("Removed from the schedule", { description: "The meme is still in Approved." });
      } catch {
        toast.error("We couldn’t remove this post. Try again.");
      }
    });
  }

  return (
    <tr className={cn("max-md:grid max-md:grid-cols-[1fr_auto] max-md:items-center max-md:gap-x-3 max-md:px-4 max-md:py-3", removing && "opacity-50")}>
      <td className="py-3 pr-3 pl-4 max-md:col-span-2 max-md:p-0">
        <div className="flex items-center gap-3">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
            {row.imageUrl ? (
              <Image src={row.imageUrl} alt="" fill sizes="48px" className="object-cover" />
            ) : (
              <ImageOffIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            {editable ? (
              <button
                type="button"
                onClick={() => openSheet("edit")}
                className="block max-w-xs truncate text-left text-sm font-medium text-primary hover:underline max-md:max-w-[15rem] max-md:py-2"
              >
                {row.title}
              </button>
            ) : (
              <p className="max-w-xs truncate text-sm font-medium max-md:max-w-[15rem]">{row.title}</p>
            )}
            <p className="text-xs text-muted-foreground">{row.source}</p>
            {row.error && (
              <p className="mt-0.5 max-w-xs truncate text-xs text-destructive" title={row.error}>
                {row.error}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap tabular-nums max-md:p-0 max-md:pt-2">{row.time}</td>
      <td className="px-3 py-3 max-md:justify-self-end max-md:p-0 max-md:pt-2">
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className="py-3 pr-4 pl-3 max-md:col-span-2 max-md:p-0 max-md:pt-3">
        <div className="flex items-center justify-end gap-1 max-md:justify-between">
          {editable && (
            <ConfirmDialog
              trigger={
                <Button size="sm" variant={row.status === "failed" ? "default" : "outline"} disabled={publishing} aria-busy={publishing}>
                  {publishing ? (
                    <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <SendIcon data-icon="inline-start" />
                  )}
                  {publishing ? "Publishing…" : row.status === "failed" ? "Retry" : "Publish now"}
                </Button>
              }
              title={`Publish “${row.title.length > 60 ? `${row.title.slice(0, 60)}…` : row.title}” now?`}
              description="This posts to your connected Instagram account right away, instead of waiting for its scheduled time."
              confirmLabel="Publish now"
              onConfirm={publish}
            />
          )}
          {editable && (
            <Menu>
              <MenuTrigger render={<IconButton label="More actions" size="icon-sm" />}>
                <EllipsisIcon />
              </MenuTrigger>
              <MenuContent>
                <MenuItem onClick={() => openSheet("edit")}>
                  <PencilIcon />
                  Edit caption or time
                </MenuItem>
                <MenuItem onClick={() => openSheet("preview")}>
                  <EyeIcon />
                  Preview on Instagram
                </MenuItem>
                {row.status === "pending" && (
                  <MenuItem destructive onClick={unschedule}>
                    <Trash2Icon />
                    Remove from schedule
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          )}
        </div>
        {editable && (
          <EditSheet row={row} timezone={timezone} username={username} tab={tab} onTabChange={setTab} open={editing} onOpenChange={setEditing} />
        )}
      </td>
    </tr>
  );
}
