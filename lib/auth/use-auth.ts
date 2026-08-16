"use client";

// Client-side auth state: current Supabase user + live updates on
// sign-in/sign-out. `loading` distinguishes "checking" from "guest".

import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

export function useAuthUser(): { user: User | null; loading: boolean } {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Ordering guard (review): once a REAL auth event lands, an in-flight
    // getUser() resolution must not overwrite the newer state. But
    // INITIAL_SESSION merely replays the locally cached user — treating it
    // as newer kept stale identity data (e.g. a phone number changed
    // server-side) alive across reloads (auth doc issue #3, 2026-08-16).
    let sawAuthEvent = false;
    let sawServerUser = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      sawServerUser = true;
      if (!sawAuthEvent) setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "INITIAL_SESSION") {
        // cached replay: fill the gap until the server answers, never after
        if (!sawServerUser && !sawAuthEvent) setUser(session?.user ?? null);
        setLoading(false);
        return;
      }
      sawAuthEvent = true;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  return { user, loading };
}

/** Best display name we can derive from a Supabase user. */
export function displayName(user: User | null): string {
  if (!user) return "Guest";
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const name = (meta?.full_name ?? meta?.name) as string | undefined;
  return name?.trim() || user.email?.split("@")[0] || "Member";
}
