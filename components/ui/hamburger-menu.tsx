"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { routes } from "@/lib/routes";

type Row = { label: string; href: string; icon: IconName; danger?: boolean };

const PRIMARY: Row[] = [
  { label: "Home", href: routes.home, icon: "home" },
  { label: "Shop", href: routes.shop, icon: "bag" },
  { label: "Spot", href: routes.spot, icon: "pin" },
  { label: "Journal", href: routes.journal, icon: "book" },
  { label: "My", href: routes.mypage, icon: "user" },
];

const ACCOUNT: Row[] = [
  { label: "Favorites", href: routes.favorites, icon: "heart" },
  { label: "Settings", href: routes.settings, icon: "user" },
  { label: "Notifications", href: routes.notifications, icon: "bell" },
  { label: "Kit status", href: routes.kitStatus, icon: "gift" },
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
      <button className="iconbtn" aria-label="Menu" onClick={() => setOpen(true)}>
        <svg className="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {open && host && createPortal(
        <>
          <div className="drawer-scrim" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-label="Menu">
            <div className="dhead">
              <span className="label">Menu</span>
              <button className="iconbtn" aria-label="Close" onClick={() => setOpen(false)}>
                <Icon name="x" size="sm" />
              </button>
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
