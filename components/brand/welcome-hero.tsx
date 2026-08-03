// Welcome-screen hero band: an abstract Seoul street grid with drop pins.
// Pure SVG (no image bytes) and every color comes from a theme token, so the
// same artwork reads correctly in both the dark and light themes.

const H = [46, 96, 146, 196, 246, 296];
const V = [30, 92, 154, 216, 278, 340];

/** City blocks between the streets; opacity varies deterministically so the
    grid looks drawn rather than generated. */
const BLOCKS = V.slice(0, -1).flatMap((x, i) =>
  H.slice(0, -1).map((y, j) => ({
    key: `${i}-${j}`,
    x: x + 5,
    y: y + 5,
    w: V[i + 1] - x - 10,
    h: H[j + 1] - y - 10,
    opacity: 0.35 + 0.5 * Math.abs(Math.sin(i * 2.3 + j * 1.7)),
  })),
);

const PINS = [
  { x: 104, y: 104, r: 4.5 },
  { x: 268, y: 90, r: 5.5 },
  { x: 302, y: 196, r: 4 },
  { x: 126, y: 212, r: 5 },
];

export function WelcomeHero() {
  return (
    <div className="welcome-hero" aria-hidden="true">
      <svg viewBox="0 0 390 320" preserveAspectRatio="xMidYMid slice">
        {/* the grid tilts like Gangnam's real street angle */}
        <g transform="rotate(-6 195 160)">
          {BLOCKS.map((b) => (
            <rect key={b.key} className="wh-block" x={b.x} y={b.y} width={b.w} height={b.h} rx="3" opacity={b.opacity} />
          ))}
          {H.map((y) => <line key={`h${y}`} className="wh-street" x1="-70" y1={y} x2="460" y2={y} />)}
          {V.map((x) => <line key={`v${x}`} className="wh-street" x1={x} y1="-70" x2={x} y2="390" />)}
          <path className="wh-river" d="M-70 272 C 60 246 140 296 232 270 S 386 242 460 264" />
        </g>
        {PINS.map((p) => (
          <circle key={`${p.x}-${p.y}`} className="wh-pin" cx={p.x} cy={p.y} r={p.r} />
        ))}
        {/* the focus pin echoes the app's own radius search */}
        <circle className="wh-ring" cx="196" cy="150" r="46" />
        <g className="wh-pin-main" transform="translate(196 150)">
          <path d="M0 -17 C7.6 -17 13 -11.6 13 -4.2 C13 4.4 0 17 0 17 C0 17 -13 4.4 -13 -4.2 C-13 -11.6 -7.6 -17 0 -17 Z" />
          <circle className="wh-pin-main-eye" cx="0" cy="-4.5" r="4.6" />
        </g>
      </svg>
    </div>
  );
}
