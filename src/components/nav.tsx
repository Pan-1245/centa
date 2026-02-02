"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/config", label: "Config" },
];

export function Nav() {
  const pathname = usePathname();

  if (pathname === "/setup") return null;

  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-primary">
          Centa
        </Link>
        <div className="flex gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname === link.href
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
