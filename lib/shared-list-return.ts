import { looksLikeListId } from "@/lib/shared-list-id";
import { routes } from "@/lib/routes";

export function sharedListReturnPath(id: string): string {
  if (!looksLikeListId(id)) throw new Error("Invalid shared list link");
  return `${routes.map}?list=${encodeURIComponent(id)}`;
}

export function signInForSharedList(id: string): string {
  return `${routes.signIn}?${new URLSearchParams({ next: sharedListReturnPath(id) })}`;
}

export function registerForSharedList(id: string): string {
  const onboarding = `${routes.onboardingBasics}?${new URLSearchParams({ next: sharedListReturnPath(id) })}`;
  return `${routes.register}?${new URLSearchParams({ next: onboarding })}`;
}
