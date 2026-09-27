import Link from "next/link";
import { signInForSharedList, registerForSharedList } from "@/lib/shared-list-return";
import type { SharedListView } from "@/lib/shared-list-view";
import { routes } from "@/lib/routes";

export function SharedListAccessBanner({
  id,
  view,
  onRetry,
}: {
  id: string;
  view: SharedListView;
  onRetry: () => void;
}) {
  if (view.status === "none" || view.status === "ok") return null;

  if (view.status === "loading") {
    return <div className="map-banner" role="status">Opening shared list…</div>;
  }

  if (view.status === "sign-in") {
    return (
      <div className="map-banner" role="status" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="small" style={{ flex: "1 1 100%" }}>Sign in to open this shared list.</span>
        <Link className="small map-banner-link" href={signInForSharedList(id)}>Sign in</Link>
        <Link className="small map-banner-link" href={registerForSharedList(id)}>Create account</Link>
        <Link className="small map-banner-link" href={routes.map}>Explore map</Link>
      </div>
    );
  }

  if (view.status === "retry") {
    return (
      <div className="map-banner" role="alert" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="small" style={{ flex: 1 }}>Couldn&apos;t load this shared list right now.</span>
        <button className="small map-banner-link" type="button" onClick={onRetry}>Try again</button>
        <Link className="small map-banner-link" href={routes.map}>Explore map</Link>
      </div>
    );
  }

  return (
    <div className="map-banner" role="status" style={{ gap: 8 }}>
      <span className="small" style={{ flex: 1 }}>This shared list isn&apos;t available.</span>
      <Link className="small map-banner-link" href={routes.map}>Explore map</Link>
    </div>
  );
}
