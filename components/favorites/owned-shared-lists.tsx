"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/components/ui/toast";
import { listOwnSharedLists, revokeSharedList, sharedListUrl, type SharedList } from "@/lib/shared-lists";

type Status = "loading" | "ready" | "error";

export function isCurrentOwnedListLoad(active: boolean, startedAtEpoch: number, currentEpoch: number): boolean {
  return active && startedAtEpoch === currentEpoch;
}

export function OwnedSharedListsView({
  status,
  items,
  confirmId,
  busy,
  onCopy,
  onAskRevoke,
  onCancel,
  onRevoke,
  onRetry,
}: {
  status: Status;
  items: SharedList[];
  confirmId: string | null;
  busy: boolean;
  onCopy: (item: SharedList) => void;
  onAskRevoke: (id: string) => void;
  onCancel: () => void;
  onRevoke: () => void;
  onRetry: () => void;
}) {
  return (
    <section className="stack sm">
      <SectionHeader title="Your shared links" count={status === "ready" ? items.length : undefined} />
      {status === "loading" && <p className="small muted" role="status">Loading shared links…</p>}
      {status === "error" && (
        <div className="row" role="alert" style={{ gap: 8 }}>
          <span className="small" style={{ flex: 1 }}>Couldn&apos;t load your links.</span>
          <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>
        </div>
      )}
      {status === "ready" && items.length === 0 && <p className="small muted">No shared links yet.</p>}
      {status === "ready" && items.map((item) => (
        <div className="stack sm" key={item.id} style={{ padding: 12, border: "1px solid var(--border)", borderRadius: 12 }}>
          <div className="row between" style={{ gap: 8 }}>
            <b className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</b>
            <span className="caption muted">
              {item.unavailablePlaceCount
                ? `${item.placeIds.length} available · ${item.placeIds.length + item.unavailablePlaceCount} saved`
                : `${item.placeIds.length} ${item.placeIds.length === 1 ? "place" : "places"}`}
            </span>
          </div>
          <span className="caption muted">Created {item.createdAt.slice(0, 10)}</span>
          {confirmId === item.id ? (
            <div className="stack sm">
              <p className="small" role="alert">Revoke {item.title}? Anyone with this link will lose access.</p>
              <div className="row" style={{ gap: 8 }}>
                <Button variant="secondary" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
                <Button variant="danger" size="sm" disabled={busy} onClick={onRevoke}>Revoke now</Button>
              </div>
            </div>
          ) : (
            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <Button variant="secondary" size="sm" onClick={() => onCopy(item)}>Copy link</Button>
              <Link className="small" href={sharedListUrl("", item.id)}>Open</Link>
              <button className="small muted" type="button" onClick={() => onAskRevoke(item.id)}>Revoke link</button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export function OwnedSharedLists({ refreshKey }: { refreshKey: number }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<SharedList[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const revokeEpoch = useRef(0);

  useEffect(() => {
    let active = true;
    const startedAtEpoch = revokeEpoch.current;
    void listOwnSharedLists().then((rows) => {
      if (!isCurrentOwnedListLoad(active, startedAtEpoch, revokeEpoch.current)) return;
      setItems(rows);
      setStatus("ready");
    }).catch(() => {
      if (isCurrentOwnedListLoad(active, startedAtEpoch, revokeEpoch.current)) setStatus("error");
    });
    return () => { active = false; };
  }, [refreshKey, reload]);

  const copyLink = async (item: SharedList) => {
    const url = sharedListUrl(window.location.origin, item.id);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      } else if (navigator.share) {
        await navigator.share({ title: item.title, url });
      } else {
        toast("Copy isn't available on this device");
      }
    } catch {
      toast("Couldn't copy this link — try again");
    }
  };

  const revoke = async () => {
    if (!confirmId || busy) return;
    setBusy(true);
    try {
      await revokeSharedList(confirmId);
      revokeEpoch.current += 1;
      setItems((rows) => rows.filter((row) => row.id !== confirmId));
      setConfirmId(null);
      toast("Shared link revoked");
      setReload((current) => current + 1);
    } catch {
      toast("Couldn't revoke this link — try again");
    } finally {
      setBusy(false);
    }
  };

  return <OwnedSharedListsView
    status={status}
    items={items}
    confirmId={confirmId}
    busy={busy}
    onCopy={(item) => { void copyLink(item); }}
    onAskRevoke={setConfirmId}
    onCancel={() => setConfirmId(null)}
    onRevoke={() => { void revoke(); }}
    onRetry={() => { setStatus("loading"); setReload((current) => current + 1); }}
  />;
}
