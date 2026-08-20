"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/ui/top-bar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useToast } from "@/components/ui/toast";
import { displayName, useAuthUser } from "@/lib/auth/use-auth";
import { routes } from "@/lib/routes";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function DisplayNameSettingsPage() {
  const { user, loading } = useAuthUser();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) setName(displayName(user));
  }, [user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || busy) return;
    const nextName = name.trim();
    if (nextName.length < 2 || nextName.length > 40) {
      setError("Use between 2 and 40 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    const { error: err } = await supabaseBrowser().auth.updateUser({
      data: {
        ...user.user_metadata,
        full_name: nextName,
        name: nextName,
      },
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setName(nextName);
    setSaved(true);
    toast("Name updated.");
    router.refresh();
  };

  return (
    <>
      <TopBar center left={<BackButton fallback={routes.settingsAccount} />} title="Display name" />
      <div className="app-scroll pad stack pagev2 settings-detail">
        {loading ? (
          <div className="settings-loading" aria-label="Loading account" />
        ) : !user ? (
          <div className="stack">
            <Notice icon="user">Sign in to change your display name.</Notice>
            <Button href={`${routes.signIn}?next=${routes.settingsName}`}>Sign in</Button>
          </div>
        ) : (
          <form className="settings-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="display-name">Display name</label>
              <input
                id="display-name"
                className="input"
                autoComplete="name"
                value={name}
                maxLength={40}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "display-name-error" : "display-name-help"}
                onChange={(event) => {
                  setName(event.target.value);
                  setError(null);
                  setSaved(false);
                }}
              />
              <p id="display-name-help" className="field-help">2–40 characters. This name appears on your profile and reviews.</p>
              {error && <p id="display-name-error" className="field-error" role="alert">{error}</p>}
            </div>
            {saved && <p className="settings-success" role="status">Name updated.</p>}
            <Button type="submit" full disabled={busy || name.trim() === displayName(user)}>
              {busy ? "Saving…" : "Save name"}
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
