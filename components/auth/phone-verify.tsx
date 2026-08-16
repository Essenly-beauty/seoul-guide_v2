"use client";

// SMS phone verification, attached to the signed-in account (Supabase
// phone_change OTP: updateUser({ phone }) sends the code, verifyOtp confirms).
// Used in onboarding and Settings. Until the owner connects an SMS provider
// (Twilio) in the Supabase dashboard, sending fails with a provider error —
// surfaced as an honest "not available yet" state, never a dead end.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { useAuthUser } from "@/lib/auth/use-auth";
import { DIAL_CODES, formatPhone, smsProviderNotReady, smsSendErrorCopy, toE164 } from "@/lib/phone";
import { supabaseBrowser } from "@/lib/supabase/client";

type Step = "input" | "code" | "done";

export function PhoneVerify({ onDone }: { onDone?: () => void }) {
  const { user, loading } = useAuthUser();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("input");
  const [dial, setDial] = useState<string>("+82");
  const [local, setLocal] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  // a verified account can swap numbers (auth doc issue #1, 2026-08-16)
  const [changing, setChanging] = useState(false);
  const phone = toE164(dial, local);

  if (loading) return null;
  if (!user) {
    return <p className="t-caption">Sign in first — the number is verified against your account.</p>;
  }
  // gate on step === "input" so a mid-flow USER_UPDATED event can never
  // yank the code entry away under the user
  if (user.phone && step === "input" && !changing && !unavailable) {
    return (
      <div className="stack sm">
        <p className="small" role="status" style={{ margin: 0 }}>
          <span style={{ color: "var(--success)", fontWeight: 600 }}>✓ Verified</span>{" "}
          <span className="mono">{formatPhone(`+${user.phone}`)}</span>{" "}
          <button className="caption" style={{ color: "var(--accent)", fontWeight: 600 }} onClick={() => setChanging(true)}>
            Change number
          </button>
        </p>
        {/* onboarding renders this already-verified — give it a real next
            step instead of a near-empty page (auth doc issue #1) */}
        {onDone && <Button size="sm" onClick={onDone}>Continue</Button>}
      </div>
    );
  }

  const sendCode = async () => {
    if (!phone || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabaseBrowser().auth.updateUser({ phone });
    setBusy(false);
    if (err) {
      // config gap → honest "not live yet"; send failure → actionable retry
      // (auth doc issue #2: the old catch-all read every failure as
      // "feature doesn't exist" — a silent churn path)
      if (smsProviderNotReady(err.message)) setUnavailable(true);
      else setError(smsSendErrorCopy(err.message));
      return;
    }
    setStep("code");
    toast(`Code sent to ${formatPhone(phone)}`);
  };

  const verify = async () => {
    if (!phone || code.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabaseBrowser().auth.verifyOtp({ phone, token: code.trim(), type: "phone_change" });
    setBusy(false);
    if (err) {
      setError(/expired|invalid/i.test(err.message) ? "That code didn't match — check it or resend." : err.message);
      return;
    }
    setStep("done");
    toast("Phone verified");
    onDone?.();
  };

  if (unavailable) {
    return (
      <div className="stack sm">
        <Notice icon="call">
          SMS verification isn&apos;t switched on yet — you can add your number
          later from Settings once it&apos;s live.
        </Notice>
        {/* never a dead end — the state may be transient */}
        <button className="caption" style={{ color: "var(--accent)", fontWeight: 600, alignSelf: "flex-start" }} onClick={() => setUnavailable(false)}>
          Try again
        </button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <p className="small" role="status">
        <span style={{ color: "var(--success)", fontWeight: 600 }}>✓ Verified</span>{" "}
        <span className="mono">{phone ? formatPhone(phone) : ""}</span>
      </p>
    );
  }

  return (
    <div className="stack sm">
      {step === "input" ? (
        <>
          <div className="row" style={{ gap: 8 }}>
            <select
              className="auth-field"
              aria-label="Country code"
              value={dial}
              onChange={(e) => setDial(e.target.value)}
              style={{ flex: "0 0 43%", minWidth: 0 }}
            >
              {DIAL_CODES.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>
            <input
              className="auth-field"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder="Phone number"
              aria-label="Phone number"
              aria-invalid={!!error}
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
          <Button disabled={!phone || busy} onClick={sendCode}>
            {busy ? "Sending…" : "Send verification code"}
          </Button>
        </>
      ) : (
        <>
          <p className="t-caption">Enter the 6-digit code sent to <b className="mono">{phone ? formatPhone(phone) : ""}</b></p>
          <input
            className="auth-field mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            aria-label="Verification code"
            aria-invalid={!!error}
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, ""))}
            style={{ letterSpacing: "0.3em", textAlign: "center" }}
          />
          <div className="row" style={{ gap: 8 }}>
            <Button variant="secondary" size="sm" style={{ flex: 1 }} disabled={busy} onClick={() => { setStep("input"); setCode(""); }}>
              Change number
            </Button>
            <Button size="sm" style={{ flex: 1 }} disabled={code.length < 4 || busy} onClick={verify}>
              {busy ? "Verifying…" : "Verify"}
            </Button>
          </div>
        </>
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}
