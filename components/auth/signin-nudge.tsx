"use client";

// Guest → account funnel (user request 2026-08-15): a small bottom sheet at
// moments where an account genuinely adds value — first save, first rating,
// the saved-places map layer. Never a wall: the guest action has already
// happened locally, and dismissing keeps full guest mode. Each context shows
// at most once per device (the map layer repeats while it has nothing to
// show, since the empty layer would otherwise just look broken).

import { useCallback, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { useAuthUser } from "@/lib/auth/use-auth";
import { routes } from "@/lib/routes";

export type NudgeContext = "favorite" | "rating" | "savedLayer";

const COPY: Record<NudgeContext, { icon: "heart" | "book" | "user"; title: string; body: string }> = {
  favorite: {
    icon: "heart",
    title: "Saved on this device",
    body: "Sign in and your saved places move to your account — backed up, and on every device you use.",
  },
  rating: {
    icon: "book",
    title: "Rating kept on this device",
    body: "Sign in to keep your ratings and review notes on your account across devices.",
  },
  savedLayer: {
    icon: "heart",
    title: "Your saved-places layer",
    body: "Tap ♥ on any place to collect it here. Sign in and the collection follows your account.",
  },
};

const seenKey = (c: NudgeContext) => `essenly.nudge.${c}`;

/** Call `nudge(context)` after a guest action; render `{sheet}` nearby. */
export function useSigninNudge(): { nudge: (c: NudgeContext, opts?: { repeat?: boolean }) => void; sheet: ReactNode } {
  const { user, loading } = useAuthUser();
  const pathname = usePathname();
  const [ctx, setCtx] = useState<NudgeContext | null>(null);

  const nudge = useCallback(
    (c: NudgeContext, opts?: { repeat?: boolean }) => {
      if (loading || user) return; // members never see it
      if (!opts?.repeat) {
        try {
          if (localStorage.getItem(seenKey(c))) return;
          localStorage.setItem(seenKey(c), "1");
        } catch { /* storage unavailable — still show once this session */ }
      }
      setCtx(c);
    },
    [loading, user],
  );

  const sheet = ctx ? (
    <BottomSheet title={COPY[ctx].title} kicker="MYSEOULDROP account" onClose={() => setCtx(null)}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <span className="ic" aria-hidden="true"><Icon name={COPY[ctx].icon} size="sm" /></span>
        <p className="small muted" style={{ margin: 0, lineHeight: 1.55 }}>{COPY[ctx].body}</p>
      </div>
      <div className="stack sm" style={{ marginTop: 16 }}>
        <Button href={`${routes.signIn}?next=${encodeURIComponent(pathname)}`}>Sign in</Button>
        <Button variant="secondary" onClick={() => setCtx(null)}>Keep browsing as guest</Button>
      </div>
    </BottomSheet>
  ) : null;

  return { nudge, sheet };
}
