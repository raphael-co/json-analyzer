"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Moon, Sun, Globe, Menu, X } from "lucide-react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/components/visuals/ui";
import { type Locale } from "@/lib/i18n";

type Dict = Record<string, string>;

export default function Navbar({ dict, locale }: { dict: Dict; locale: Locale }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const segments = pathname?.split("/") || [];
  const currentLocale: Locale =
    segments[1] === "en" || segments[1] === "fr" ? (segments[1] as Locale) : locale;
  const restPath = segments.slice(2).join("/");
  const href = (l: string, p: string = "") => `/${l}/${p}`.replace(/\/$/, "");

  const links = [
    { href: href(currentLocale), label: dict.nav_home },
    { href: href(currentLocale, "projects"), label: dict.nav_projects },
    { href: href(currentLocale, "experience"), label: dict.nav_experience },
    { href: href(currentLocale, "about"), label: dict.nav_about },
    { href: href(currentLocale, "relaxation"), label: dict.relaxation },
    { href: href(currentLocale, "contact"), label: dict.nav_contact }
  ];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const ThemeButton = (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-full border p-2 dark:border-white/10"
    >
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="block h-4 w-4 dark:hidden" />
    </button>
  );

  const LangSwitcherDesktop = (
    <div className="relative">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border px-3 py-1.5 text-sm dark:border-white/10">
          <Globe className="h-4 w-4" />
          <span className="uppercase">{currentLocale}</span>
        </summary>
        <div className="absolute right-0 mt-2 w-28 rounded-xl border bg-white p-1 shadow-lg dark:border-white/10 dark:bg-neutral-900">
          {(["fr", "en"] as const).map((l) => (
            <Link
              key={l}
              href={href(l, restPath)}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10",
                l === currentLocale && "opacity-70"
              )}
            >
              {l.toUpperCase()}
            </Link>
          ))}
        </div>
      </details>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 bg-white/70 shadow-sm backdrop-blur dark:bg-black/50">
      <nav className="container mx-auto flex items-center justify-between px-4 py-3">
        <Link href={href(currentLocale)} className="flex items-center gap-2">
          <Image
            src="/favicon.svg"
            alt="Logo"
            width={24}
            height={24}
            priority
            className="h-6 w-6"
          />
          <span className="font-semibold">Raphael Comandon</span>
        </Link>

        <div className="hidden items-center gap-3 md:flex md:gap-6">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "text-sm opacity-70 hover:opacity-100",
                pathname === l.href && "font-medium opacity-100"
              )}
            >
              {l.label}
            </Link>
          ))}
          {LangSwitcherDesktop}
          {ThemeButton}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {ThemeButton}
          <button
            type="button"
            aria-label="Open menu"
            aria-controls="mobile-menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-xl border p-2 dark:border-white/10"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden md:hidden"
          >
            <div className="container mx-auto px-4 pb-4">
              <div className="rounded-2xl border bg-white/80 p-2 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/60">
                <div className="flex flex-col">
                  {links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className={cn(
                        "rounded-xl px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10",
                        pathname === l.href && "font-medium"
                      )}
                    >
                      {l.label}
                    </Link>
                  ))}

                  <div className="mt-2 flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2 dark:bg-white/[0.06]">
                    <span className="text-sm opacity-80">Lang</span>
                    <div className="flex gap-2">
                      {(["fr", "en"] as const).map((l) => (
                        <Link
                          key={l}
                          href={href(l, restPath)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs dark:border-white/10",
                            l === currentLocale &&
                              "bg-black text-white dark:bg-white dark:text-black"
                          )}
                        >
                          {l.toUpperCase()}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
