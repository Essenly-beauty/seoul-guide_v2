import { redirect } from "next/navigation";
import { LoginClient } from "@/components/auth/login-client";
import { supabaseServer } from "@/lib/supabase/server";
import { routes } from "@/lib/routes";

// Already signed in? Straight to the app — showing the login form to a
// member reads as "auto sign-in is broken" (user report 2026-08-15).
// ?switch=1 keeps the form reachable on purpose (log in as someone else,
// from Settings); signing in then simply replaces the session — the
// shared-device isolation purge handles the account hand-over.
export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.switch !== "1") {
    const { data: { user } } = await supabaseServer().auth.getUser();
    if (user) redirect(routes.map);
  }
  return <LoginClient />;
}
