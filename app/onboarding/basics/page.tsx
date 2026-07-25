import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { BasicsForm } from "@/components/onboarding/basics-form";
import { routes } from "@/lib/routes";

export default function BasicsPage() {
  return (
    <>
      <TopBar
        left={<BackButton fallback={routes.splash} />}
        title={<span className="steplabel" style={{ flex: 1 }}>Step 1 of 3</span>}
      />
      <div style={{ padding: "0 18px" }}>
        <div className="progress"><div className="fill" style={{ width: "33%" }} /></div>
      </div>
      <div className="app-scroll pad">
        <BasicsForm />
      </div>
    </>
  );
}
