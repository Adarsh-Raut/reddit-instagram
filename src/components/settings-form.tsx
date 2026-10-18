"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { updateSettings, type SettingsState } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { AppSettings } from "@/db/queries";
import { settingsFormInput } from "@/lib/settings";
import { useActionToast } from "@/lib/use-action-toast";
import { useProgrammaticFocus } from "@/lib/use-programmatic-focus";

type Name = "subreddits" | "scrapeCount" | "postSlots" | "timezone";
type Errors = Partial<Record<Name, string>>;

const MESSAGES: Record<Name, string> = {
  subreddits: "Add 1 to 10 subreddit names, like memes or dankmemes.",
  scrapeCount: "Use a number between 1 and 50.",
  postSlots: "Use 24-hour times like 09:00, separated by commas.",
  timezone: "Pick a timezone name like Asia/Kolkata or America/New_York.",
};

function validate(form: HTMLFormElement): Errors {
  const data = new FormData(form);
  const result = settingsFormInput.safeParse(Object.fromEntries(data));
  if (result.success) return {};
  const out: Errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as Name;
    if (key in MESSAGES && !out[key]) out[key] = MESSAGES[key];
  }
  return out;
}

export function SettingsForm({ settings, timezones }: { settings: AppSettings; timezones: string[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateSettings, null);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<Name, boolean>>>({});
  useActionToast(state);
  const focusing = useProgrammaticFocus();

  const blur = (name: Name) => (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched((t) => ({ ...t, [name]: true }));
    setErrors(validate(e.currentTarget.form!));
  };
  const clear = (name: Name) => () => {
    if (!focusing.isProgrammatic()) setErrors((er) => ({ ...er, [name]: undefined }));
  };
  const err = (name: Name) => (touched[name] ? errors[name] : null);

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        const found = validate(e.currentTarget);
        setErrors(found);
        setTouched({ subreddits: true, scrapeCount: true, postSlots: true, timezone: true });
        const firstBad = (Object.keys(MESSAGES) as Name[]).find((n) => found[n]);
        if (firstBad) {
          e.preventDefault();
          focusing.focus(e.currentTarget.elements.namedItem(firstBad) as HTMLElement | null);
        }
      }}
      className="space-y-5"
    >
      <Field label="Subreddits" hint="Memes are scraped from these. Separate names with commas." error={err("subreddits")}>
        {(a11y) => (
          <Input
            {...a11y}
            name="subreddits"
            defaultValue={settings.subreddits.join(", ")}
            placeholder="memes, dankmemes"
            onFocus={clear("subreddits")}
            onBlur={blur("subreddits")}
          />
        )}
      </Field>
      <Field label="Memes per scrape" hint="How many new memes each scrape adds, up to 50." error={err("scrapeCount")}>
        {(a11y) => (
          <Input
            {...a11y}
            type="number"
            inputMode="numeric"
            name="scrapeCount"
            min={1}
            max={50}
            defaultValue={settings.scrapeCount}
            className="w-28"
            onFocus={clear("scrapeCount")}
            onBlur={blur("scrapeCount")}
          />
        )}
      </Field>
      <Field
        label="Daily post times"
        hint="24-hour format. Use at least 3 times for 3 posts a day."
        error={err("postSlots")}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="postSlots"
            defaultValue={settings.postSlots.join(", ")}
            placeholder="09:00, 14:00, 20:00"
            onFocus={clear("postSlots")}
            onBlur={blur("postSlots")}
          />
        )}
      </Field>
      <Field label="Timezone" hint="Post times and the schedule use this timezone." error={err("timezone")}>
        {(a11y) => (
          <>
            <Input
              {...a11y}
              name="timezone"
              list="timezone-options"
              autoComplete="off"
              defaultValue={settings.timezone}
              onFocus={clear("timezone")}
              onBlur={blur("timezone")}
            />
            <datalist id="timezone-options">
              {timezones.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <div className="flex items-center justify-end border-t pt-4">
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
