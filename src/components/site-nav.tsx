import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/schedule", label: "Schedule" },
  { href: "/settings", label: "Settings" },
];

export function SiteNav() {
  return (
    <nav aria-label="Main" className="border-b">
      <div className="mx-auto flex max-w-5xl items-center gap-5 px-6 py-3 text-sm">
        <span className="font-semibold">Reddit → Instagram</span>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
