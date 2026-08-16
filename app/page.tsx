import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

// The welcome gateway is gone (user decision 2026-08-16): everyone lands
// straight on the map — Kakao Map style. The account is sold contextually
// by the join sheet (My tab, place details, hearts) instead of a front door.
export default function RootPage() {
  redirect(routes.map);
}
