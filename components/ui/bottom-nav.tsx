import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { routes } from "@/lib/routes";

export type NavKey = "map" | "ranking" | "blog" | "saved" | "menu";

const ITEMS: { key: NavKey; label: string; icon: IconName; href: string }[] = [
  { key: "map", label: "Map", icon: "pin", href: routes.map },
  { key: "ranking", label: "Ranking", icon: "bag", href: routes.ranking },
  { key: "blog", label: "Blog", icon: "book", href: routes.blog },
  { key: "saved", label: "Saved", icon: "heart", href: routes.favorites },
  { key: "menu", label: "Menu", icon: "user", href: routes.menu },
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
        >
          <Icon name={item.icon} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
