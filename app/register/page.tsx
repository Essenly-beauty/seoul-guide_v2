import { redirect } from "next/navigation";
import { RegisterClient } from "@/components/auth/register-client";
import { supabaseServer } from "@/lib/supabase/server";
import { routes } from "@/lib/routes";

// A signed-in visitor normally belongs in the app, but `?switch=1` keeps
// registration available when they deliberately choose to create another
// account on a shared device. This mirrors the sign-in route.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (params.switch !== "1") {
    const { data: { user } } = await supabaseServer().auth.getUser();
    if (user) redirect(routes.map);
  }
  return <RegisterClient />;
}
