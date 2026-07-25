import Link from "next/link";
import { TopBar } from "@/components/ui/top-bar";
import { BottomNav } from "@/components/ui/bottom-nav";
import { BackButton } from "@/components/ui/back-button";
import { ChipGroup } from "@/components/ui/chip-group";
import { ActionButton } from "@/components/ui/action-button";
import { SectionHeader } from "@/components/ui/section-header";
import { FeedbackLauncher } from "@/components/ui/feedback-sheet";
import { SignoutModal } from "@/components/ui/signout-modal";
import { Icon } from "@/components/icon";
import { routes } from "@/lib/routes";

export default function SettingsPage() {
  return (
    <>
      <TopBar center left={<BackButton fallback={routes.menu} />} title="Settings" />
      <div className="app-scroll pad stack pagev2">
        <section className="stack sm">
          <SectionHeader title="Beauty profile" />
          <p className="t-caption">Used to match you with the right salons, spas, and clinics.</p>
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Hair" />
          <div className="label">Hair Type</div>
          <ChipGroup ariaLabel="Hair type" single items={["Straight", "Wavy", "Curly"]} defaultSelected={["Straight"]} />
          <div className="label">Hair Concerns</div>
          <ChipGroup ariaLabel="Hair concerns" items={["Damaged", "Scalp", "Volume", "Frizz", "Thinning"]} defaultSelected={["Damaged"]} />
          <div className="field">
            <label htmlFor="settings-hair-brand">Current hair brand · Optional</label>
            <input
              id="settings-hair-brand"
              className="input"
              placeholder="e.g. Pantene, Aveda"
              maxLength={60}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Skin" />
          <div className="label">Skin Type</div>
          <ChipGroup ariaLabel="Skin type" single items={["Dry", "Oily", "Combo", "Sensitive"]} defaultSelected={["Dry"]} />
          <div className="label">Skin Concerns</div>
          <ChipGroup ariaLabel="Skin concerns" items={["Hydration", "Brightening", "Acne", "Anti-aging", "Pores", "Redness"]} defaultSelected={["Hydration", "Brightening"]} />
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="Trip & interests" />
          <div className="field">
            <label htmlFor="settings-country">Country</label>
            <select id="settings-country" className="input" defaultValue="United States" autoComplete="country-name">
              <option>United States</option><option>Canada</option><option>United Kingdom</option><option>Japan</option><option>Singapore</option>
            </select>
          </div>
          <div className="label">Interests</div>
          <ChipGroup ariaLabel="Interests" items={["Shopping", "Salon", "Spa", "Clinic", "Spots"]} defaultSelected={["Shopping", "Salon"]} />
          <div className="label">K-Beauty experience</div>
          <ChipGroup ariaLabel="K-Beauty experience" single items={["First time", "Know a bit", "Obsessed"]} defaultSelected={["Know a bit"]} />
          <div className="label">Monthly beauty spend · Optional</div>
          <ChipGroup ariaLabel="Monthly beauty spend" single items={["Under $50", "$50–100", "$100–200", "$200+"]} />
        </section>

        <hr className="sec-divider" />
        <section className="stack sm">
          <SectionHeader title="About" />
          <div>
            <Link className="listrow v2" href={routes.legalTerms}>
              <span className="ic"><Icon name="lock" size="sm" /></span>
              <b className="t-label-md" style={{ fontSize: 14, flex: 1, minWidth: 0 }}>Terms of Service</b>
              <Icon name="chev" size="xs" className="chev" />
            </Link>
            <Link className="listrow v2" href={routes.legalPrivacy}>
              <span className="ic"><Icon name="lock" size="sm" /></span>
              <b className="t-label-md" style={{ fontSize: 14, flex: 1, minWidth: 0 }}>Privacy Policy</b>
              <Icon name="chev" size="xs" className="chev" />
            </Link>
            <FeedbackLauncher className="listrow v2" style={{ width: "100%" }}>
              <span className="ic"><Icon name="ext" size="sm" /></span>
              <b className="t-label-md" style={{ fontSize: 14, flex: 1, minWidth: 0, textAlign: "left" }}>Send feedback</b>
              <Icon name="chev" size="xs" className="chev" />
            </FeedbackLauncher>
          </div>
        </section>

        <ActionButton className="btn" toast="Saved!">Save Changes</ActionButton>
        <SignoutModal />
      </div>
      <BottomNav active="menu" />
    </>
  );
}
