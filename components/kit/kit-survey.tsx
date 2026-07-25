"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { BackButton } from "@/components/ui/back-button";
import { validateKitClaim, type KitClaimErrors, type KitClaimMethod } from "@/lib/kit-claim";
import { routes } from "@/lib/routes";

const STEP_LABEL = (i: number) => (i === 0 ? "FREE HAIR KIT" : i >= 4 ? "ALL SET" : `STEP ${i} OF 3`);
const STEP_PCT = (i: number) => (i === 0 ? 8 : i >= 4 ? 100 : Math.round((i / 3) * 100));

export function KitSurvey() {
  const [step, setStep] = useState(0);
  const [via, setVia] = useState<KitClaimMethod>("hotel");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [claimErrors, setClaimErrors] = useState<KitClaimErrors>({});
  const emailInputRef = useRef<HTMLInputElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const clearClaimError = (field: keyof KitClaimErrors) => {
    setClaimErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const selectDeliveryMethod = (method: KitClaimMethod) => {
    setVia(method);
    if (method === "cafe") clearClaimError("address");
  };

  const submitClaim = () => {
    const errors = validateKitClaim({ email, via, address });
    setClaimErrors(errors);

    if (errors.email) {
      emailInputRef.current?.focus();
      return;
    }
    if (errors.address) {
      addressInputRef.current?.focus();
      return;
    }

    setStep(4);
  };

  return (
    <>
      <div className="topbar">
        {step > 0 && step < 4 ? (
          <button className="iconbtn" aria-label="Back" onClick={() => setStep((s) => s - 1)}>
            <Icon name="back" />
          </button>
        ) : (
          <BackButton fallback={routes.map} />
        )}
        <span className="steplabel" style={{ flex: 1 }}>
          {STEP_LABEL(step)}
        </span>
      </div>
      <div style={{ padding: "0 18px" }}>
        <div className="progress">
          <div className="fill" style={{ width: STEP_PCT(step) + "%" }} />
        </div>
      </div>

      <div className="app-scroll pad">
        {step === 0 && (
          <div>
            <div style={{ textAlign: "center", padding: "6px 0" }}>
              <span className="ic" style={{ width: 56, height: 56, borderRadius: "var(--r-full)", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 10px" }}>
                <Icon name="gift" />
              </span>
              <h1 className="h1">Free Essenly Hair Kit</h1>
              <p className="muted" style={{ marginTop: 6 }}>Takes about 30 seconds.</p>
            </div>
            <div className="card stack sm" style={{ marginTop: 14 }}>
              {["Hair pack (2 uses)", "Leave-in essence (travel size)", "Personalized routine card"].map((t) => (
                <div className="row" key={t} style={{ gap: 9 }}>
                  <Icon name="check" size="sm" style={{ color: "var(--accent)" }} />
                  <span className="small">{t}</span>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 8, justifyContent: "center", marginTop: 12 }}>
              <span className="stars">★★★★★</span>
              <span className="small muted">4.8 on Amazon · 1,200+ reviews</span>
            </div>
            <div className="stack sm" style={{ marginTop: 14 }}>
              {["Complete a 3-step survey.", "We prepare your kit.", "Pick it up in Seoul."].map((t, i) => (
                <div className="row" key={t} style={{ gap: 10 }}>
                  <span className="badge accent">0{i + 1}</span>
                  <span className="small">{t}</span>
                </div>
              ))}
            </div>
            <div className="banner warning" style={{ marginTop: 14 }}>
              <Icon name="bell" size="sm" />
              <span>Apply 7+ days before arrival. 1 kit per person.</span>
            </div>
            <Button style={{ marginTop: 14 }} onClick={() => setStep(1)}>
              Get My Free Kit →
            </Button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="h2">Your hair</h2>
            <div className="label" style={{ marginTop: 14 }}>Hair type</div>
            <ChipGroup ariaLabel="Hair type" single items={["Straight", "Wavy", "Curly"]} defaultSelected={["Straight"]} />
            <div className="label" style={{ marginTop: 14 }}>Hair concerns</div>
            <ChipGroup ariaLabel="Hair concerns" items={["Damaged", "Scalp", "Volume", "Frizz", "Thinning"]} defaultSelected={["Damaged"]} />
            <Button style={{ marginTop: 24 }} onClick={() => setStep(2)}>Next →</Button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="h2">Your habits</h2>
            <div className="label" style={{ marginTop: 14 }}>Hair length</div>
            <ChipGroup ariaLabel="Hair length" single items={["Short", "Medium", "Long"]} defaultSelected={["Medium"]} />
            <div className="label" style={{ marginTop: 14 }}>Wash frequency</div>
            <ChipGroup ariaLabel="Wash frequency" single items={["Every day", "2–3×/week", "4–5×/week", "Once/week"]} defaultSelected={["2–3×/week"]} />
            <div className="label" style={{ marginTop: 14 }}>Treatment experience</div>
            <ChipGroup ariaLabel="Treatment experience" single items={["Never", "Sometimes", "Regularly"]} defaultSelected={["Sometimes"]} />
            <Button style={{ marginTop: 24 }} onClick={() => setStep(3)}>Next →</Button>
          </div>
        )}

        {step === 3 && (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submitClaim();
            }}
          >
            <h2 className="h2">Contact &amp; pickup</h2>
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="kit-claim-email">Email</label>
              <input
                ref={emailInputRef}
                id="kit-claim-email"
                name="email"
                className="input"
                type="email"
                inputMode="email"
                enterKeyHint="next"
                autoComplete="email"
                value={email}
                required
                aria-invalid={Boolean(claimErrors.email)}
                aria-describedby={claimErrors.email ? "kit-claim-email-error" : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearClaimError("email");
                }}
              />
              {claimErrors.email && (
                <p id="kit-claim-email-error" className="station-field-error" role="alert">
                  {claimErrors.email}
                </p>
              )}
            </div>
            <div className="label" style={{ marginTop: 14 }}>Receive via</div>
            <button type="button" className="pickcard" aria-pressed={via === "hotel"} style={{ marginTop: 8 }} onClick={() => selectDeliveryMethod("hotel")}>
              <span className="ic"><Icon name="pin" size="sm" /></span>
              <div><b>Hotel / Airbnb</b><div className="caption muted">We send to your accommodation.</div></div>
              <span className="chk"><Icon name="check" size="xs" /></span>
            </button>
            <button type="button" className="pickcard" aria-pressed={via === "cafe"} style={{ marginTop: 8 }} onClick={() => selectDeliveryMethod("cafe")}>
              <span className="ic"><Icon name="bag" size="sm" /></span>
              <div><b>Cafe pickup</b><div className="caption muted">Pick up from a partner cafe.</div></div>
              <span className="chk"><Icon name="check" size="xs" /></span>
            </button>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="kit-claim-address">
                Accommodation address{via === "cafe" ? " (optional)" : ""}
              </label>
              <input
                ref={addressInputRef}
                id="kit-claim-address"
                name="address"
                className="input"
                type="text"
                inputMode="text"
                enterKeyHint="done"
                autoComplete="street-address"
                placeholder="Hotel name + address in Seoul"
                value={address}
                required={via === "hotel"}
                aria-invalid={Boolean(claimErrors.address)}
                aria-describedby={claimErrors.address ? "kit-claim-address-error" : undefined}
                onChange={(event) => {
                  setAddress(event.target.value);
                  clearClaimError("address");
                }}
              />
              {claimErrors.address && (
                <p id="kit-claim-address-error" className="station-field-error" role="alert">
                  {claimErrors.address}
                </p>
              )}
            </div>
            <div className="banner warning" style={{ marginTop: 12 }}>
              <Icon name="bell" size="sm" />
              <span>Apply 7 days before arrival so we have time to prepare your kit.</span>
            </div>
            <Button type="submit" style={{ marginTop: 16 }}>Claim My Free Kit</Button>
          </form>
        )}

        {step === 4 && (
          <div>
            <div style={{ textAlign: "center", padding: "26px 0" }}>
              <span className="ic" style={{ width: 64, height: 64, borderRadius: "var(--r-full)", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
                <Icon name="check" />
              </span>
              <h1 className="h1">You&apos;re All Set!</h1>
              <p className="muted" style={{ marginTop: 8, maxWidth: "28ch", marginInline: "auto" }}>
                We&apos;ll prepare your kit and notify you when it&apos;s ready for pickup.
              </p>
            </div>
            <div className="stack" style={{ marginTop: 8 }}>
              <Button href={routes.kitStatus}>View My Kit Status</Button>
              <Button variant="secondary" onClick={() => router.push(routes.map)}>Back to Home</Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
