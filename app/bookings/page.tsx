import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// Launch scope (codex cross-check #5): the bookings list rendered hardcoded
// confirmations/refunds. No real bookings exist — route home until they do.
// The prototype UI lives in git history for when the feature is real.
export default function BookingsPage() {
  redirect(routes.menu);
}
