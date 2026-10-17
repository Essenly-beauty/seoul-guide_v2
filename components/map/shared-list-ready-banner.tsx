import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/ui/icon-button";
import type { SharedList } from "@/lib/shared-lists";

export function SharedListReadyBanner({
  list,
  onSaveAll,
  onClose,
}: {
  list: SharedList;
  onSaveAll: () => void;
  onClose: () => void;
}) {
  const available = list.placeIds.length;
  return (
    <div className="map-banner" role="status" style={{ flexWrap: "wrap" }}>
      <Icon name="heart" size="xs" style={{ color: "var(--accent)", flex: "none" }} aria-hidden="true" />
      <span className="small" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        <b>{list.title}</b> · {available} {available === 1 ? "place" : "places"}
      </span>
      {available > 0 && <Button size="sm" style={{ flex: "none" }} onClick={onSaveAll}>Save all</Button>}
      <IconButton name="x" label="Close shared list" size={32} iconSize="xs" onClick={onClose} />
      {available === 0 && <span className="small muted" style={{ flex: "1 1 100%" }}>No places from this link are currently listed.</span>}
      {available > 0 && Boolean(list.unavailablePlaceCount) && (
        <span className="caption muted" style={{ flex: "1 1 100%" }}>
          {list.unavailablePlaceCount} {list.unavailablePlaceCount === 1 ? "place is" : "places are"} no longer listed.
        </span>
      )}
    </div>
  );
}
