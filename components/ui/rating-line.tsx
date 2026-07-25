/** `★ 4.4 (320)` — rating with optional review count (spec v2 §8).
    `plain` renders quiet amber text instead of the pill — for dense list rows (doc2 semantic roles). */
export function RatingLine({ rating, count, plain }: { rating?: number; count?: number; plain?: boolean }) {
  if (rating === undefined) return null;
  return (
    <span className={plain ? "rating plain num" : "rating"}>
      ★ {rating}
      {count !== undefined && <span className="muted" style={{ fontWeight: 500 }}> ({count})</span>}
    </span>
  );
}
