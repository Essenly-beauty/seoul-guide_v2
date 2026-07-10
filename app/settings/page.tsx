import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ChipGroup } from "@/components/ui/chip-group";
import { ActionButton } from "@/components/ui/action-button";
import { SignoutModal } from "@/components/ui/signout-modal";
import { routes } from "@/lib/routes";

export default function SettingsPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="Settings" />
      <div className="app-scroll pad stack">
        <div>
          <div className="label">Profile</div>
          <div className="h1">Edit your <span style={{ fontStyle: "italic", color: "var(--accent)" }}>beauty profile.</span></div>
        </div>

        <div className="label">Hair Type</div>
        <ChipGroup single items={["Straight", "Wavy", "Curly"]} defaultSelected={["Straight"]} />
        <div className="label">Hair Concerns</div>
        <ChipGroup items={["Damaged", "Scalp", "Volume", "Frizz", "Thinning"]} defaultSelected={["Damaged"]} />
        <div className="field">
          <label>Current hair brand · Optional</label>
          <input className="input" placeholder="e.g. Pantene, Aveda" maxLength={60} />
        </div>

        <div className="label" style={{ marginTop: 6 }}>Skin Type</div>
        <ChipGroup single items={["Dry", "Oily", "Combo", "Sensitive"]} defaultSelected={["Dry"]} />
        <div className="label">Skin Concerns</div>
        <ChipGroup items={["Hydration", "Brightening", "Acne", "Anti-aging", "Pores", "Redness"]} defaultSelected={["Hydration", "Brightening"]} />

        <div className="field" style={{ marginTop: 6 }}>
          <label>Country</label>
          <select className="input" defaultValue="United States">
            <option>United States</option><option>Canada</option><option>United Kingdom</option><option>Japan</option><option>Singapore</option>
          </select>
        </div>
        <div className="label">Interests</div>
        <ChipGroup items={["Shopping", "Salon", "Spa", "Clinic", "Spots"]} defaultSelected={["Shopping", "Salon"]} />
        <div className="label">K-Beauty experience</div>
        <ChipGroup single items={["First time", "Know a bit", "Obsessed"]} defaultSelected={["Know a bit"]} />
        <div className="label">Monthly beauty spend · Optional</div>
        <ChipGroup single items={["Under $50", "$50–100", "$100–200", "$200+"]} />

        <div className="label" style={{ marginTop: 6 }}>About</div>
        <Link className="card tap row between" href={routes.legalTerms}>
          <b>Terms of Service</b><span className="caption dim">→</span>
        </Link>
        <Link className="card tap row between" href={routes.legalPrivacy}>
          <b>Privacy Policy</b><span className="caption dim">→</span>
        </Link>

        <ActionButton className="btn" toast="Saved!">Save Changes</ActionButton>
        <SignoutModal />
      </div>
      <BottomNav active="menu" />
    </>
  );
}
