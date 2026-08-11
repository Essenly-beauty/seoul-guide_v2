import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// Launch audit P0-3: the fake "Submitted Apr 4" kit status is gone — the
// program hasn't launched, so status routes to the honest coming-soon page.
export default function KitStatusPage() {
  redirect(routes.kitSurvey);
}
