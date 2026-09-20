// How much of the layout viewport the software keyboard is covering.
//
// The on-screen keyboard shrinks the VISUAL viewport and leaves the layout
// viewport alone (MDN VisualViewport), so a fixed panel keeps its full height
// and its lower half ends up behind the keyboard. Reading the difference lets
// the panel shrink instead.

export type ViewportReading = {
  innerHeight: number;
  viewportHeight: number;
  offsetTop: number;
  scale: number;
};

/** Sub-pixel jitter is reported constantly during a resize; anything under a
    pixel is not a keyboard and must not thrash the custom property. */
const NOISE_PX = 1;

export function keyboardInset({ innerHeight, viewportHeight, offsetTop, scale }: ViewportReading): number {
  // While pinch-zoomed the visual viewport is smaller for a different reason.
  if (scale > 1.01) return 0;
  const inset = innerHeight - viewportHeight - offsetTop;
  if (!Number.isFinite(inset) || inset < NOISE_PX) return 0;
  return Math.round(inset);
}
