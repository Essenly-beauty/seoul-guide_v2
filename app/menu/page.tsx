import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { SectionHeader } from "@/components/ui/section-header";
import { SectionDivider } from "@/components/ui/section-divider";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { FeedbackLauncher } from "@/components/ui/feedback-sheet";
import { BrandMark, BrandWordmark } from "@/components/brand/brand-logo";
import { ProfileCard } from "@/components/mypage/profile-card";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";

type MenuRow = { icon: Parameters<typeof Icon>[0]["name"]; title: string; value?: string; href: string; badge?: string };

const GROUPS: { title: string; rows: MenuRow[] }[] = [
  {
    title: "My activity",
    rows: [
      { icon: "cal", title: "Reservations", value: "HOSU DOSAN · May 4", href: routes.bookings, badge: "D-5" },
      { icon: "plane", title: "My Trip", value: "Seoul", href: routes.trip },
      { icon: "gift", title: "Beauty Kit", value: "Survey & shipping", href: routes.kitStatus },
      { icon: "heart", title: "Saved", href: routes.favorites, badge: "11" },
      { icon: "book", title: "My reviews", href: routes.reviews, badge: "2" },
    ],
  },
  {
    title: "Preferences",
    rows: [
      { icon: "user", title: "Beauty profile", value: "Skin & hair type", href: routes.onboardingInterests },
      { icon: "bell", title: "Notifications", href: routes.notifications },
      { icon: "mark", title: "Settings", href: routes.settings },
    ],
  },
  {
    title: "Support",
    rows: [
      { icon: "cross", title: "Help & support", href: routes.support },
      { icon: "lock", title: "Terms & privacy", href: routes.legalTerms },
    ],
  },
];

export default function MenuPage() {
  return (
    <>
      <TopBar title="Menu" />
      <div className="app-scroll pad stack pagev2">
        {/* Profile header block */}
        <section className="stack">
          <div className="row" style={{ gap: 14 }}>
            <Avatar name="S" size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 17 }}>Sarah</b>
              <div className="caption muted">Member · Starter</div>
            </div>
            <IconButton name="user" label="Edit profile" variant="soft" href={routes.settings} />
          </div>
          <div className="row between" style={{ textAlign: "center" }}>
            {[["1", "Reservations"], ["11", "Saved"], ["2", "My reviews"]].map(([n, l]) => (
              <div key={l} style={{ flex: 1 }}>
                <div className="h2" style={{ color: "var(--accent)" }}>{n}</div>
                <div className="caption muted">{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Progressive-profiling gauge + one-tap question (docs §4-1) */}
        <ProfileCard />

        {GROUPS.map((g) => (
          <div key={g.title} className="stack" style={{ gap: 12 }}>
            <SectionDivider />
            <section className="stack sm">
              <SectionHeader title={g.title} />
              {g.rows.map((m) => (
                <Link key={m.title} className="inforow" href={m.href}>
                  <Icon name={m.icon} size="xs" />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</span>
                  <span className="chev row" style={{ gap: 7 }}>
                    {m.value && <span className="caption muted">{m.value}</span>}
                    {m.badge && <Badge tone="dim">{m.badge}</Badge>}
                    <Icon name="chev" size="xs" style={{ color: "var(--dim)" }} />
                  </span>
                </Link>
              ))}
              {g.title === "Support" && (
                <FeedbackLauncher className="inforow" style={{ width: "100%" }}>
                  <Icon name="ext" size="xs" />
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Send feedback</span>
                  <span className="chev row" style={{ gap: 7 }}>
                    <Icon name="chev" size="xs" style={{ color: "var(--dim)" }} />
                  </span>
                </FeedbackLauncher>
              )}
            </section>
          </div>
        ))}

        {/* Brand footer — mark + wordmark, the one place the app signs itself */}
        <div className="stack sm" style={{ alignItems: "center", padding: "20px 0 8px" }}>
          <BrandMark size={30} />
          <BrandWordmark size={13} />
          <span className="caption dim">Seoul beauty, mapped.</span>
        </div>
      </div>
      <BottomNav active="menu" />
    </>
  );
}
