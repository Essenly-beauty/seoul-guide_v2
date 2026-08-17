"use client";

// Menu profile header — real session state instead of the old "Sarah" mock.
// Guests get a sign-in nudge; members see their name and email.

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SignoutModal } from "@/components/ui/signout-modal";
import { displayName, useAuthUser } from "@/lib/auth/use-auth";
import { routes } from "@/lib/routes";

export function MenuProfile() {
  const { user, loading } = useAuthUser();
  const name = displayName(user);

  // Neutral skeleton while the session check runs — flashing the member
  // layout at guests read as the wrong affordance (review).
  if (loading) {
    return (
      <div className="row" style={{ gap: 14 }} aria-busy="true">
        <Avatar name=" " size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ width: 96, height: 15, borderRadius: 6, background: "var(--surface-hover)" }} />
          <div style={{ width: 150, height: 11, borderRadius: 6, background: "var(--surface-hover)", marginTop: 7 }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="row" style={{ gap: 14 }}>
        <Avatar name="?" size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 17 }}>Guest</b>
          <div className="caption muted">Sign in to sync your favorites</div>
        </div>
        <Button size="sm" href={`${routes.signIn}?next=${routes.menu}`} style={{ flex: "none" }}>
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 14 }}>
      <Avatar name={name[0]?.toUpperCase() ?? "M"} size={52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 17 }}>{name}</b>
        <div className="caption muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user?.email ?? "Member"}
        </div>
      </div>
      <div className="row" style={{ gap: 8, flex: "none" }}>
        <IconButton name="user" label="Edit profile" variant="soft" href={routes.settings} />
        <SignoutModal compact />
      </div>
    </div>
  );
}
