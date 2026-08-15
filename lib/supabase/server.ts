// Server-side Supabase client for Server Components and Route Handlers.
// Reads the session from request cookies; writes are only possible in Route
// Handlers / Server Actions (Next.js forbids cookie writes during RSC render,
// hence the try/catch — the middleware refresh keeps sessions alive anyway).

import { cookies, type UnsafeUnwrappedCookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function supabaseServer() {
  const cookieStore = (cookies() as unknown as UnsafeUnwrappedCookies);
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // RSC render — middleware handles the refresh instead.
          }
        },
      },
    },
  );
}
