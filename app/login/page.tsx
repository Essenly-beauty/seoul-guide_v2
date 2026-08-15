import { redirect } from "next/navigation";
import { LoginClient } from "@/components/auth/login-client";
import { supabaseServer } from "@/lib/supabase/server";
import { routes } from "@/lib/routes";

// Already signed in? Straight to the app — showing the login form to a
// member reads as "auto sign-in is broken" (user report 2026-08-15).
export default async function SignInPage() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (user) redirect(routes.map);
  return <LoginClient />;
}
