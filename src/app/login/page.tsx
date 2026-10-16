import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Reddit → Instagram</h1>
      <LoginForm />
    </main>
  );
}
