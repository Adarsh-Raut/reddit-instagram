"use client";

import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { addMeme, type AddMemeState } from "@/app/actions/memes";
import { Button } from "@/components/ui/button";
import { Field, Input, controlClass } from "@/components/ui/field";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useActionToast } from "@/lib/use-action-toast";
import { useProgrammaticFocus } from "@/lib/use-programmatic-focus";

/** Upload your own meme. Short task, so it opens as a slide-over and keeps the list in view. */
export function AddMemeSheet() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AddMemeState, FormData>(addMeme, null);
  const [touched, setTouched] = useState({ image: false, title: false });
  const [errors, setErrors] = useState<{ image?: string; title?: string }>({});
  useActionToast(state);
  const focusing = useProgrammaticFocus();

  // close after a successful upload
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) setOpen(false);
  }

  function check(form: HTMLFormElement) {
    const data = new FormData(form);
    const file = data.get("image");
    const title = String(data.get("title") ?? "").trim();
    return {
      image: file instanceof File && file.size > 0 ? undefined : "Choose a JPEG, PNG or WebP image.",
      title: title ? undefined : "Add a title. It becomes the caption.",
    } as { image?: string; title?: string };
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" />}>
        <PlusIcon data-icon="inline-start" />
        Add meme
      </SheetTrigger>
      <SheetContent title="Add your own meme" description="It goes straight to Approved, ready to schedule.">
        <form
          action={action}
          noValidate
          onSubmit={(e) => {
            const found = check(e.currentTarget);
            setErrors(found);
            setTouched({ image: true, title: true });
            if (found.image || found.title) {
              e.preventDefault();
              focusing.focus(e.currentTarget.elements.namedItem(found.image ? "image" : "title") as HTMLElement | null);
            }
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <Field
              label="Image"
              hint="JPEG, PNG or WebP, up to 4 MB."
              error={touched.image ? errors.image : null}
            >
              {(a11y) => (
                <input
                  {...a11y}
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/webp"
                  onBlur={(e) => {
                    setTouched((t) => ({ ...t, image: true }));
                    setErrors((er) => ({ ...er, image: check(e.currentTarget.form!).image }));
                  }}
                  onChange={(e) => setErrors((er) => ({ ...er, image: check(e.currentTarget.form!).image }))}
                  className={cn(
                    controlClass,
                    "py-2 file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium file:text-foreground",
                  )}
                />
              )}
            </Field>
            <Field
              label="Title"
              hint="Used as the caption. Up to 200 characters."
              error={touched.title ? errors.title : null}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  name="title"
                  maxLength={200}
                  autoComplete="off"
                  onFocus={() => !focusing.isProgrammatic() && setErrors((er) => ({ ...er, title: undefined }))}
                  onBlur={(e) => {
                    setTouched((t) => ({ ...t, title: true }));
                    setErrors((er) => ({ ...er, title: check(e.currentTarget.form!).title }));
                  }}
                />
              )}
            </Field>
            {state && !state.ok && (
              <p role="alert" className="text-sm text-destructive">
                {state.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t p-4">
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
              {pending ? "Uploading…" : "Add meme"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
