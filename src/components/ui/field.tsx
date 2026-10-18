import { useId } from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "w-full rounded-lg border border-input bg-card px-3 text-base text-foreground shadow-soft transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:opacity-60 md:text-sm motion-reduce:transition-none";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlClass, "h-10 max-md:h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlClass, "min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(controlClass, "h-10 max-md:h-11", className)} {...props}>
      {children}
    </select>
  );
}

/**
 * Label above the control, helper text below, and an optional error that replaces the helper.
 * Pass the control as a render function so the label/description ids are wired up for free.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
  children: (a11y: { id: string; "aria-describedby": string | undefined; "aria-invalid": true | undefined }) => React.ReactNode;
}) {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {optional && <span className="ml-1 font-normal text-muted-foreground">(optional)</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={`${id}-desc`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-desc`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
