import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { BeautyProfileEditor } from "@/components/mypage/beauty-profile-editor";
import { routes } from "@/lib/routes";

/** Detailed questions stay available after sign-up, never in the join flow. */
export default function BeautyProfilePage() {
  return (
    <>
      <TopBar left={<BackButton fallback={routes.menu} />} title="Beauty profile" />
      <div className="app-scroll pad stack profile-editor-page">
        <div>
          <div className="label">OPTIONAL PROFILE</div>
          <div className="h1">
            Tune your<br />
            <span style={{ fontStyle: "italic", color: "var(--accent)" }}>Seoul picks.</span>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>Answer only what helps you. You can return anytime from My.</p>
        </div>
        <BeautyProfileEditor />
        <Button href={routes.menu}>Done</Button>
      </div>
    </>
  );
}
