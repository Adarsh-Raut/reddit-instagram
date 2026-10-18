import { SendIcon } from "lucide-react";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-card p-6 shadow-soft sm:p-8">
        <div className="space-y-4">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <SendIcon className="size-5" aria-hidden />
          </span>
          <div className="space-y-1">
            <h1 className="text-2xl leading-tight font-semibold">Sign in</h1>
            <p className="text-sm text-muted-foreground">Enter the admin password to manage your Reddit → Instagram queue.</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
