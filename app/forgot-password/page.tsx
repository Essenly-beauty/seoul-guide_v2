import { ForgotPasswordClient } from "@/components/auth/forgot-password-client";
import { safeAuthNext } from "@/lib/auth-return";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <ForgotPasswordClient next={safeAuthNext(params.next) ?? undefined} />;
}
