"use client";

import { useState } from "react";
import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { useAuthUser } from "@/lib/auth/use-auth";
import { routes } from "@/lib/routes";
import { supabaseBrowser } from "@/lib/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailSettingsPage() {
  const { user, loading } = useAuthUser();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || busy) return;
    const nextEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(nextEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (nextEmail === user.email?.toLowerCase()) {
      setError("That is already your account email.");
      return;
    }
    setBusy(true);
    setError(null);
    setPendingEmail(null);
    const { error: err } = await supabaseBrowser().auth.updateUser({ email: nextEmail });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setPendingEmail(nextEmail);
    toast("Confirmation emails sent.");
  };

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.settingsAccount} />} title="Email address" />
      <div className="app-scroll pad stack pagev2 settings-detail">
        {loading ? (
          <div className="settings-loading" aria-label="Loading account" />
        ) : !user ? (
          <div className="stack">
            <Notice icon="user">Sign in to change your email address.</Notice>
            <Button href={`${routes.signIn}?next=${routes.settingsEmail}`}>Sign in</Button>
          </div>
        ) : (
          <form className="settings-form" onSubmit={submit}>
            <div className="settings-current-value">
              <span>Current email</span>
              <strong>{user.email ?? "Not set"}</strong>
            </div>
            <div className="field">
              <label htmlFor="new-email">New email</label>
              <input
                id="new-email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
                required
                value={email}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "email-change-error" : "email-change-help"}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                  setPendingEmail(null);
                }}
              />
              <p id="email-change-help" className="field-help">For your security, the address changes only after email confirmation.</p>
              {error && <p id="email-change-error" className="field-error" role="alert">{error}</p>}
            </div>
            {pendingEmail && (
              <Notice tone="accent" icon="ext" role="status">
                Check both your current and new email inboxes to confirm the change to <strong>{pendingEmail}</strong>.
              </Notice>
            )}
            <Button type="submit" full disabled={busy || email.trim().length === 0}>
              {busy ? "Sending…" : "Send confirmation emails"}
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
