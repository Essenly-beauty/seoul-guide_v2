import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// New accounts use the default light theme. Keep this legacy URL so an old
// redirect never strands someone on a redundant preference screen; returning
// visitors still keep any theme they explicitly chose in Settings.
export default function ChooseModePage() {
  redirect(routes.onboardingBasics);
}
