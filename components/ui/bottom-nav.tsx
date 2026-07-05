import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import { routes } from "@/lib/routes";

export type NavKey = "home" | "shop" | "spot" | "journal" | "my";

const ITEMS: { key: NavKey; label: string; icon: IconName; href: string }[] = [
  { key: "home", label: "Home", icon: "home", href: routes.home },
  { key: "shop", label: "Shop", icon: "bag", href: routes.shop },
  { key: "spot", label: "Spot", icon: "pin", href: routes.spot },
  { key: "journal", label: "Journal", icon: "book", href: routes.journal },
  { key: "my", label: "My", icon: "user", href: routes.mypage },
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
