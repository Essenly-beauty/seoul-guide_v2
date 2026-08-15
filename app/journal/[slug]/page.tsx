import { redirect } from "next/navigation";
import { routes } from "@/lib/routes";

export default async function JournalArticleRedirect(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  redirect(routes.blogArticle(params.slug));
}
