import { TopBar } from "@/components/ui/top-bar";
import { BasicsForm } from "@/components/onboarding/basics-form";

export default async function BasicsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  return (
    <>
      <TopBar />
      <div className="app-scroll pad">
        <BasicsForm next={next} />
      </div>
    </>
  );
}
