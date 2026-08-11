import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// Launch scope: My Trip was a prototype itinerary with fixed demo data.
export default function TripPage() {
  redirect(routes.menu);
}
