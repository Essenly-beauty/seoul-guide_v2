import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { RoutineContent } from "@/components/shop/routine-content";
import { routes } from "@/lib/routes";

export default function RoutinePage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.shop} />} title="Routine" />
      <div className="app-scroll pad">
        <RoutineContent />
      </div>
      <BottomNav active="shop" />
    </>
  );
}
