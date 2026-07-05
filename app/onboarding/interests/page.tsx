import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { InterestsForm } from "@/components/onboarding/interests-form";
import { routes } from "@/lib/routes";

export default function InterestsPage() {
  return (
    <>
      <TopBar
        left={<BackButton fallback={routes.splash} />}
        title={<span className="steplabel" style={{ flex: 1 }}>Step 1 of 2</span>}
      />
      <div style={{ padding: "0 18px" }}>
        <div className="progress"><div className="fill" style={{ width: "50%" }} /></div>
      </div>
      <div className="app-scroll pad">
        <InterestsForm />
      </div>
    </>
  );
}
