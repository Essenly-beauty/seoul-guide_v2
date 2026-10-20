import { T } from "@/lib/i18n/locale-provider";
import Link from "next/link";

/** Detail-page section header: title (+ count) left, "See all ›" style action right (spec v2 §4.6). */
export function SectionHeader({ title, count, actionLabel, href, onAction }: {
  title: string;
  count?: number;
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
}) {
  const action =
    actionLabel &&
    (href ? (
      <Link className="small muted section-action" href={href}><T text={actionLabel} /> ›</Link>
    ) : (
      <button type="button" className="small muted section-action" onClick={onAction}><T text={actionLabel} /> ›</button>
    ));
  return (
    <div className="row between section-heading" style={{ alignItems: "baseline" }}>
      <h2 className="h2" style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 600 }}>
        <T text={title} />
        {count !== undefined && <span className="section-heading-count muted">{count}</span>}
      </h2>
      {action}
    </div>
  );
}
