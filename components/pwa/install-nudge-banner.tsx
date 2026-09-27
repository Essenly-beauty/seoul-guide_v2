"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/ui/icon-button";
import { useInstallOffer } from "@/lib/install-nudge";
import { routes } from "@/lib/routes";

/** One line offering the Home Screen install, shown after the visitor has got
 *  something out of the app.
 *
 *  Installing is what removes the browser's own header and footer, which is
 *  the whole point of the offer, and the app has been installable since it
 *  shipped. The guide at /download was reachable only from the hamburger menu,
 *  so a first-time visitor never learned it existed.
 *
 *  It stays a line rather than a sheet: the sign-in nudge already owns the
 *  bottom sheet at account-value moments, and two sheets competing for the
 *  same moment is worse than either. lib/install-nudge-policy.ts decides when
 *  this may appear; everything here is presentation. */
export function InstallNudgeBanner() {
  const { offered, dismiss } = useInstallOffer();
  if (!offered) return null;
  return (
    <div className="map-banner" role="status">
      <Icon name="home" size="xs" style={{ color: "var(--accent)", flex: "none" }} aria-hidden="true" />
      <span className="small" style={{ flex: 1, minWidth: 0 }}>
        Add MYSEOULDROP to your Home Screen and the browser bars go away.
      </span>
      <Button size="sm" style={{ flex: "none" }} href={routes.download} onClick={dismiss}>
        How
      </Button>
      <IconButton name="x" label="Dismiss install suggestion" size={32} iconSize="xs" onClick={dismiss} />
    </div>
  );
}
