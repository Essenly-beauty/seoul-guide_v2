import { ResetPasswordClient } from "@/components/auth/reset-password-client";
import { safeAuthNext } from "@/lib/auth-return";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return <ResetPasswordClient next={safeAuthNext(params.next) ?? undefined} />;
}
