"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { routes } from "@/lib/routes";

export type NavKey = "map" | "ranking" | "blog" | "saved" | "menu";

const ITEMS: { key: NavKey; label: string; icon: IconName; href: string }[] = [
  // Board M-1 order (지도·이야기·홈·즐찾·마이): Stories sits second; Ranking takes the
  // center slot since /home redirects to /map in this app (spec §4.1).
  { key: "map", label: "Map", icon: "pin", href: routes.map },
  { key: "blog", label: "Stories", icon: "book", href: routes.blog },
  { key: "ranking", label: "Ranking", icon: "bag", href: routes.ranking },
  { key: "saved", label: "Saved", icon: "heart", href: routes.favorites },
  { key: "menu", label: "My", icon: "user", href: routes.menu },
];

export function BottomNav({ active }: { active?: NavKey }) {
  return (
    <nav className="bottomnav" aria-label="Main">
      {ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className="nav"
          aria-current={active === item.key ? "page" : undefined}
          onClick={() => {
            if (item.key === "map") window.dispatchEvent(new CustomEvent("myseouldrop:map-cycle"));
          }}
        >
          <Icon name={item.icon} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
