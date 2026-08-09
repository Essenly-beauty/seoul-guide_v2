"use client";

// Browser-side Supabase client (singleton per tab). Auth state lives in
// cookies via @supabase/ssr so the middleware and server components see the
// same session.

import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
