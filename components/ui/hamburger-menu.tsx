"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { IconButton } from "@/components/ui/icon-button";
import { routes } from "@/lib/routes";

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
  { label: "Terms of Service", href: routes.legalTerms, icon: "book" },
  { label: "Privacy Policy", href: routes.legalPrivacy, icon: "lock" },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<Element | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Anchor the overlay to .app-shell (full height), not the sticky topbar it lives in.
  useEffect(() => {
    setHost(document.querySelector(".app-shell"));
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <IconButton name="menu" label="Menu" iconSize="md" onClick={() => setOpen(true)} />

      {open && host && createPortal(
        <>
          <div className="drawer-scrim" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-label="Menu">
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
            <button className="drow danger" onClick={() => { setOpen(false); router.push(routes.splash); }}>
              <Icon name="door" size="sm" />Sign out
            </button>
          </div>
        </>,
        host,
      )}
    </>
  );
}
