// MYSEOULDROP brand assets — the supplied Seoul mark and the two-tone
// wordmark (MY + DROP in text color, SEOUL + the period in signal orange).
// Wordmark type is Michroma (--brand-display), the squared techno face
// closest to the reference logotype.

const ORANGE = "var(--accent)";

/** Supplied Seoul mark, shared with the browser and PWA app icon. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    // The mark is decorative here; the adjacent wordmark carries the brand name.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon.svg" alt="" aria-hidden="true" width={size} height={size} style={{ display: "block" }} />
  );
}

/** One-line wordmark: MY SEOUL DROP. — SEOUL and the period carry the accent. */
export function BrandWordmark({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{
        fontFamily: "var(--brand-display)",
        fontSize: size,
        letterSpacing: "0.04em",
        color: "var(--text)",
        whiteSpace: "nowrap",
      }}
    >
      MY<span style={{ color: ORANGE }}>SEOUL</span>DROP<span style={{ color: ORANGE }}>.</span>
    </span>
  );
}

/** Stacked 3-per-row lockup (MYS / EOU / LDR / OP.) from the reference sheet. */
export function BrandWordmarkStacked({ size = 26 }: { size?: number }) {
  const rows: [string, boolean][][] = [
    // [letter, isOrange] — the letters spelling SEOUL (and the dot) are orange.
    [["M", false], ["Y", false], ["S", true]],
    [["E", true], ["O", true], ["U", true]],
    [["L", true], ["D", false], ["R", false]],
    [["O", false], ["P", false], [".", true]],
  ];
  return (
    <span
      aria-label="MYSEOULDROP"
      style={{
        display: "inline-block",
        fontFamily: "var(--brand-display)",
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: "0.1em",
        color: "var(--text)",
      }}
    >
      {rows.map((row, i) => (
        <span key={i} style={{ display: "block" }}>
          {row.map(([ch, orange], j) => (
            <span key={j} style={orange ? { color: ORANGE } : undefined}>{ch}</span>
          ))}
        </span>
      ))}
    </span>
  );
}
