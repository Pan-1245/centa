"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { updateCurrency } from "@/lib/actions";
import type { CurrencyCode } from "@/lib/currency";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/summary", label: "Summary" },
  { href: "/config", label: "Config" },
];

const currencies: { code: CurrencyCode; label: string }[] = [
  { code: "THB", label: "฿ THB" },
  { code: "USD", label: "$ USD" },
  { code: "JPY", label: "¥ JPY" },
];

export function Nav({ currency = "THB" }: { currency?: string }) {
  const pathname = usePathname();

  if (pathname === "/setup") return null;

  return (
    <nav className="border-b bg-card">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight text-primary">
            Centa
          </Link>
          <div className="flex gap-1">
            {navLinks.map((link) => (
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

        <div className="flex gap-1 rounded-md border p-0.5">
          {currencies.map((c) => (
            <button
              key={c.code}
              onClick={async () => {
                if (c.code === currency) return;
                const fd = new FormData();
                fd.set("currency", c.code);
                await updateCurrency(fd);
              }}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors",
                c.code === currency
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
