import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { ChipGroup } from "@/components/ui/chip-group";
import { routes } from "@/lib/routes";

export default function BeautyProfilePage() {
  return (
    <>
      <TopBar title={<span className="steplabel" style={{ flex: 1 }}>Step 3 of 3</span>} />
      <div style={{ padding: "0 18px" }}>
        <div className="progress"><div className="fill" style={{ width: "100%" }} /></div>
      </div>
      <div className="app-scroll pad stack">
        <div>
          <div className="label">Step 3 · Beauty Profile</div>
          <div className="h1">
            Tell us about<br />
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>your skin &amp; hair.</span>
          </div>
        </div>

        <div className="label">Skin Type *</div>
        <ChipGroup ariaLabel="Skin type" single items={["Dry", "Oily", "Combo", "Sensitive"]} defaultSelected={["Dry"]} />

        <div className="label">Skin Concerns</div>
        <ChipGroup ariaLabel="Skin concerns" items={["Hydration", "Brightening", "Acne", "Anti-aging", "Pores", "Redness"]} defaultSelected={["Hydration", "Brightening"]} />

        <div className="label">Hair Type</div>
        <ChipGroup ariaLabel="Hair type" single items={["Straight", "Wavy", "Curly"]} defaultSelected={["Straight"]} />

        <div className="label">Hair Concerns</div>
        <ChipGroup ariaLabel="Hair concerns" items={["Damaged", "Scalp", "Volume", "Frizz", "Thinning"]} defaultSelected={["Damaged"]} />

        <div className="field">
          <label htmlFor="current-hair-brand">Current Hair Brand · Optional</label>
          <input
            id="current-hair-brand"
            className="input"
            placeholder="e.g. Pantene, Aveda, Olaplex"
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="label">Monthly Beauty Spend · Optional</div>
        <ChipGroup ariaLabel="Monthly beauty spend" single items={["Under $50", "$50–100", "$100–200", "$200+"]} />

        <div className="row" style={{ marginTop: 8, gap: 10 }}>
          <Link className="btn ghost" href={routes.onboardingInterests} style={{ flex: 1 }}>Prev</Link>
          <Link className="btn" href={routes.map} style={{ flex: 2 }}>Get Started</Link>
        </div>
      </div>
    </>
  );
}
