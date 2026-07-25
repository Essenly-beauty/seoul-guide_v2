/** 5→1 star distribution bars (spec v2 §4.6-9). `dist[0]` = share of 5-star reviews. */
export function RatingBars({ dist }: { dist: [number, number, number, number, number] }) {
  const total = dist.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="stack" style={{ gap: 4, flex: 1 }}>
      {dist.map((n, i) => {
        const stars = 5 - i;
        const percent = Math.round((n / total) * 100);
        return (
          <div key={stars} className="row" style={{ gap: 7 }}>
            <span aria-hidden="true" className="caption muted mono" style={{ width: 10, textAlign: "right" }}>{stars}</span>
            <span className="rbar" role="img" aria-label={`${stars} stars: ${percent}%`}>
              <i style={{ width: `${percent}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}
