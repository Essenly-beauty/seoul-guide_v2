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
      <Link className="small muted section-action" href={href}>{actionLabel} ›</Link>
    ) : (
      <button type="button" className="small muted section-action" onClick={onAction}>{actionLabel} ›</button>
    ));
  return (
    <div className="row between" style={{ alignItems: "baseline" }}>
      {/* Board sections are bold sans, not the brand serif (spec §4.6). */}
      <h2 className="h2" style={{ fontFamily: "var(--sans)", fontSize: 16, fontWeight: 700 }}>
        {title}
        {count !== undefined && <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}> · {count}</span>}
      </h2>
      {action}
    </div>
  );
}
