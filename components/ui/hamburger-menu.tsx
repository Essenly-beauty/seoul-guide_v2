"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { IconButton } from "@/components/ui/icon-button";
import { routes } from "@/lib/routes";
import { useExitTransition } from "@/components/ui/use-exit-transition";

type Row = { label: string; href: string; icon: IconName; danger?: boolean };

const PRIMARY: Row[] = [
  { label: "Map", href: routes.map, icon: "pin" },
  { label: "Ranking", href: routes.ranking, icon: "bag" },
  { label: "Blog", href: routes.blog, icon: "book" },
  { label: "Saved", href: routes.favorites, icon: "heart" },
  { label: "Menu", href: routes.menu, icon: "user" },
];

// Launch scope: Notifications and Kit status are prototype-only — hidden
// from public navigation until real (audit P0-3).
const ACCOUNT: Row[] = [
  { label: "Favorites", href: routes.favorites, icon: "heart" },
  { label: "Settings", href: routes.settings, icon: "user" },
];

const ABOUT: Row[] = [
  { label: "Install app", href: routes.download, icon: "home" },
  { label: "Terms of Service", href: routes.legalTerms, icon: "book" },
  { label: "Privacy Policy", href: routes.legalPrivacy, icon: "lock" },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const pathname = usePathname();
  // Stay mounted while the drawer animates out (R6).
  const { mounted, closing } = useExitTransition(open);

  // This drawer never used the shared dialog hook, so Escape did nothing.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Anchor the overlay to .app-shell (full height), not the sticky topbar it lives in.
  useEffect(() => {
    setHost(document.querySelector(".app-shell"));
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <IconButton name="menu" label="Menu" iconSize="md" onClick={() => setOpen(true)} />

      {mounted && host && createPortal(
        <>
          <div
            className={closing ? "drawer-scrim closing" : "drawer-scrim"}
            onClick={() => setOpen(false)}
          />
          <div className={closing ? "drawer closing" : "drawer"} role="dialog" aria-label="Menu">
            <div className="dhead">
              <span className="label">Menu</span>
              <IconButton name="x" label="Close" onClick={() => setOpen(false)} />
            </div>

            <div className="dsection label">Primary</div>
            {PRIMARY.map((r) => (
              <Link key={r.href} href={r.href} className="drow" aria-current={isActive(r.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                <Icon name={r.icon} size="sm" />{r.label}
              </Link>
            ))}

            <div className="dsection label">Account</div>
            {ACCOUNT.map((r) => (
              <Link key={r.href} href={r.href} className="drow" aria-current={isActive(r.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                <Icon name={r.icon} size="sm" />{r.label}
              </Link>
            ))}
            <div className="dsection label">About</div>
            {ABOUT.map((r) => (
              <Link key={r.href} href={r.href} className="drow" onClick={() => setOpen(false)}>
                <Icon name={r.icon} size="sm" />{r.label}
              </Link>
            ))}
          </div>
        </>,
        host,
      )}
    </>
  );
}
