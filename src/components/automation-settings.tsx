"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateAutomation } from "@/app/actions/schedule";
import { Input } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import type { AutomationPatch } from "@/lib/settings";

type Props = { autoScrape: boolean; autoSchedule: boolean; autoScheduleDays: number };

function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="space-y-0.5">
        <label htmlFor={id} className="block text-sm font-medium">
          {label}
        </label>
        <p id={`${id}-desc`} className="max-w-prose text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} aria-describedby={`${id}-desc`} />
    </div>
  );
}

/** Switches save the moment they change; the previous value comes back if saving fails. */
export function AutomationSettings(initial: Props) {
  const [values, setValues] = useState<Props>(initial);
  const [pending, startTransition] = useTransition();
  const [daysError, setDaysError] = useState<string | null>(null);

  function save(patch: AutomationPatch) {
    const before = values;
    setValues((v) => ({ ...v, ...patch }));
    startTransition(async () => {
      try {
        const r = await updateAutomation(patch);
        if (r?.ok) toast.success("Saved.");
        else {
          setValues(before);
          toast.error(r?.message ?? "We couldn’t save that change. Try again.");
        }
      } catch {
        setValues(before);
        toast.error("We couldn’t save that change. Check your connection and try again.");
      }
    });
  }

  const daysId = useId();
  return (
    <div className="divide-y">
      <SwitchRow
        label="Scrape new memes every day"
        description="Runs at 06:00 UTC. New memes still wait for your approval."
        checked={values.autoScrape}
        disabled={pending}
        onChange={(next) => save({ autoScrape: next })}
      />
      <SwitchRow
        label="Schedule memes when I approve them"
        description="Each approved meme takes the next free post time, so you never have to schedule by hand."
        checked={values.autoSchedule}
        disabled={pending}
        onChange={(next) => save({ autoSchedule: next })}
      />
      <div className="space-y-1.5 py-4 last:pb-0">
        <label htmlFor={daysId} className="block text-sm font-medium">
          Days to look ahead
        </label>
        <Input
          id={daysId}
          type="number"
          inputMode="numeric"
          min={1}
          max={90}
          defaultValue={values.autoScheduleDays}
          aria-invalid={daysError ? true : undefined}
          aria-describedby={`${daysId}-desc`}
          className="w-28"
          onFocus={() => setDaysError(null)}
          onBlur={(e) => {
            const n = Number(e.currentTarget.value);
            if (!Number.isInteger(n) || n < 1 || n > 90) {
              setDaysError("Use a whole number between 1 and 90.");
              return;
            }
            if (n !== values.autoScheduleDays) save({ autoScheduleDays: n });
          }}
        />
        <p id={`${daysId}-desc`} role={daysError ? "alert" : undefined} className={daysError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {daysError ?? "How far ahead automatic scheduling fills your calendar. Saves when you leave the field."}
        </p>
      </div>
    </div>
  );
}
