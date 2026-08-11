import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// Launch scope (codex cross-check #5): the toggles promised email/push
// delivery but were component-local state. Route to Settings until a real
// notification channel exists.
export default function NotificationsPage() {
  redirect(routes.settings);
}
