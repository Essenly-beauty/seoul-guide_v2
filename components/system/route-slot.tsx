"use client";

import type { ReactNode } from "react";

/** Hands the route's content to React from a function component, not straight
    from the app-shell <div>. While the page is still hydrating, the route
    element can be waiting on a JS chunk; React then pauses on whichever fiber
    holds it and replays that fiber once the chunk lands. Next 15's bundled
    React replays a host <div> without moving its hydration cursor back, so the
    <div> tried to claim its own first child and hydration failed (#418, 2 of
    160 production place-page loads). Replaying a function component is safe;
    lib/route-slot-contract.test.ts has the numbers. */
export function RouteSlot({ children }: { children: ReactNode }) {
  return children;
}
