import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";

const MENU: { icon: Parameters<typeof Icon>[0]["name"]; title: string; desc: string; href: string; badge?: string }[] = [
  { icon: "cal", title: "Reservations", desc: "Next: HOSU DOSAN · Mon, May 4 · 14:00", href: routes.bookings, badge: "D-5" },
  { icon: "plane", title: "My Trip", desc: "Seoul · itinerary & beauty schedule", href: routes.trip },
  { icon: "gift", title: "Beauty Kit", desc: "Free kit survey & shipping status", href: routes.kitStatus },
  { icon: "heart", title: "Saved", desc: "Places, products & blog posts", href: routes.favorites, badge: "11" },
  { icon: "book", title: "My reviews", desc: "2 written", href: routes.reviews, badge: "2" },
  { icon: "user", title: "Beauty profile", desc: "Interests, skin & hair type", href: routes.onboardingInterests },
  { icon: "bell", title: "Notifications", desc: "Booking, kit, blog, promotions", href: routes.notifications },
  { icon: "mark", title: "Settings", desc: "Account & app preferences", href: routes.settings },
  { icon: "cross", title: "Help & support", desc: "FAQ · contact Essenly support", href: routes.support },
  { icon: "lock", title: "Terms & privacy", desc: "Legal documents", href: routes.legalTerms },
];

export default function MenuPage() {
  return (
    <>
      <TopBar title="Menu" />
      <div className="app-scroll pad stack">
        <div className="card row" style={{ gap: 14 }}>
          <span className="avatar" style={{ width: 52, height: 52, fontSize: 18 }}>S</span>
          <div style={{ flex: 1 }}>
            <b style={{ fontSize: 17 }}>Sarah</b>
            <div className="caption muted">Member · Starter</div>
          </div>
          <Link className="btn sm ghost" href={routes.settings}>Edit profile</Link>
        </div>

        <div className="card row between" style={{ textAlign: "center" }}>
          {[["1", "Reservations"], ["11", "Saved"], ["2", "My reviews"]].map(([n, l]) => (
            <div key={l} style={{ flex: 1 }}>
              <div className="h2" style={{ color: "var(--accent)" }}>{n}</div>
              <div className="caption muted">{l}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: "4px 16px" }}>
          {MENU.map((m) => (
            <Link key={m.title} className="listrow" href={m.href}>
              <span className="ic"><Icon name={m.icon} size="sm" /></span>
              <div><b>{m.title}</b><div className="caption muted">{m.desc}</div></div>
              {m.badge && <span className="badge dim" style={{ marginLeft: "auto" }}>{m.badge}</span>}
              <Icon name="chev" size="sm" className="chev" />
            </Link>
          ))}
        </div>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
