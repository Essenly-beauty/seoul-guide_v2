import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// Launch scope (codex cross-check #5): the detail claimed a paid deposit and
// refund entitlement that never existed.
export default function BookingDetailPage() {
  redirect(routes.menu);
}
