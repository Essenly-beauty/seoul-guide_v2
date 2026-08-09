// Session refresh middleware (@supabase/ssr pattern): rotates the auth
// cookies on every matched request so server components always see a live
// session. No route gating here — the app works logged-out (guest mode);
// pages decide for themselves what to show.

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touching getUser() is what triggers the token refresh when needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets — auth cookies must stay fresh on all
    // real pages and API routes.
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|apple-icon.png|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
