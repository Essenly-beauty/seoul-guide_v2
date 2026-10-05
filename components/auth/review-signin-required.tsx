"use client";

import { useSigninNudge } from "./signin-nudge";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

export function ReviewSigninRequired() {
  const { nudge, sheet } = useSigninNudge();
  return <section className="stack sm">
    {sheet}
    <p>Sign in to rate places, write reviews, and see your reviews.</p>
    <Button onClick={() => nudge("rating")}>Sign in to rate and review</Button>
    <Button variant="secondary" href={routes.map}>Browse the map</Button>
  </section>;
}
