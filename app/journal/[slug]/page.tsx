import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

export default function JournalArticleRedirect({ params }: { params: { slug: string } }) {
  redirect(routes.blogArticle(params.slug));
}
