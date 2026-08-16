"use client";

// "Continue as guest" — a real choice, not fine print. Remembers the choice
// in a cookie so returning guests skip the welcome pitch and land straight
// on the map, exactly like members do (user request 2026-08-16).

import { useRouter } from "next/navigation";
import { routes } from "@/lib/routes";

export const GUEST_COOKIE = "essenly_guest";

export function GuestEntryButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="welcome-guest-btn"
      onClick={() => {
        document.cookie = `${GUEST_COOKIE}=1; max-age=31536000; path=/; SameSite=Lax`;
        router.push(routes.map);
      }}
    >
      Continue as guest
    </button>
  );
}
