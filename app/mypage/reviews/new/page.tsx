import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// Launch scope (codex cross-check #5): this mock form said "Review submitted"
// without saving anywhere. Real review writing lives on each place page
// (rate + private review, account-synced).
export default function WriteReviewPage() {
  redirect(routes.reviews);
}
