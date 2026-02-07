"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { updateCurrency } from "@/lib/actions/config";
import type { CurrencyCode } from "@/lib/currency";
import { Menu, X } from "lucide-react";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (pathname === "/setup") return null;

  return (
    <nav className="bg-card border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-primary text-lg font-semibold tracking-tight"
          >
            Centa
          </Link>
          {/* Desktop navigation */}
          <div className="hidden gap-1 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname === link.href
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Currency selector - visible on all sizes */}
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
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-md p-2 sm:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation menu */}
      {mobileMenuOpen && (
        <div className="bg-card border-t sm:hidden">
          <div className="flex flex-col px-4 py-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm transition-colors",
                  pathname === link.href
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
