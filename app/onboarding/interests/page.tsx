import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { InterestsForm } from "@/components/onboarding/interests-form";
import { routes } from "@/lib/routes";

export default function InterestsPage() {
  return (
    <>
      <TopBar
        left={<BackButton fallback={routes.onboardingBasics} />}
        title={<span className="steplabel" style={{ flex: 1 }}>Step 2 of 3</span>}
      />
      <div style={{ padding: "0 18px" }}>
        <div className="progress"><div className="fill" style={{ width: "66%" }} /></div>
      </div>
      <div className="app-scroll pad">
        <InterestsForm />
      </div>
    </>
  );
}
