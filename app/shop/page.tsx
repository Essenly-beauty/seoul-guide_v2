import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

export default function ShopRedirect() {
  redirect(routes.ranking);
}
