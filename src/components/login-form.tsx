"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          required
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
      </label>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {state && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}
