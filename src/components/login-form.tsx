"use client";

import { EyeIcon, EyeOffIcon, LoaderCircleIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { IconButton } from "@/components/ui/tooltip";
import { useProgrammaticFocus } from "@/lib/use-programmatic-focus";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, null);
  const [show, setShow] = useState(false);
  const [missing, setMissing] = useState(false);
  const focusing = useProgrammaticFocus();
  // a server error stays until the user returns to the field, then clears (it can't be reset in the action state)
  const [dismissed, setDismissed] = useState<LoginState>(null);
  const error = missing ? "Enter your password to sign in." : state && state !== dismissed ? state.message : null;

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        const empty = !String(new FormData(e.currentTarget).get("password") ?? "");
        setMissing(empty);
        if (empty) {
          e.preventDefault();
          focusing.focus(e.currentTarget.elements.namedItem("password") as HTMLElement | null);
        }
      }}
      className="space-y-5"
    >
      <Field label="Password" error={error}>
        {(a11y) => (
          <div className="relative">
            <Input
              {...a11y}
              type={show ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              autoFocus
              className="pr-11"
              onFocus={() => {
                if (focusing.isProgrammatic()) return;
                setMissing(false);
                setDismissed(state);
              }}
              onChange={() => {
                setMissing(false);
                setDismissed(state);
              }}
            />
            <div className="absolute top-1/2 right-1 -translate-y-1/2">
              <IconButton
                label={show ? "Hide password" : "Show password"}
                size="icon-sm"
                onClick={() => setShow((s) => !s)}
                aria-pressed={show}
              >
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </IconButton>
            </div>
          </div>
        )}
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
        {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
