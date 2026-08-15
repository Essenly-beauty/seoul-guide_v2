import { redirect } from "next/navigation";
import { RegisterClient } from "@/components/auth/register-client";
import { supabaseServer } from "@/lib/supabase/server";
import { routes } from "@/lib/routes";

export default async function RegisterPage() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (user) redirect(routes.map);
  return <RegisterClient />;
}
