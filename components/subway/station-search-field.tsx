"use client";

import { T, useLocale } from "@/lib/i18n/locale-provider";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/ui/icon-button";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { LINE_META, STATIONS, lineTextColor } from "@/lib/subway";
import { stationSearchGroups } from "@/lib/subway-station-search";
import styles from "./station-search-field.module.css";

type StationSearchProps = {
  label: string;
  selectedId: string | null;
  nearbyStationId: string | null;
  recentIds: string[];
  locationStatus: "idle" | "loading" | "granted" | "fallback";
  onRetryLocation: () => void;
  onSelect: (id: string | null, advanceFocus?: boolean) => void;
};

/** Route fields remain committed values. Queries exist only on the search page. */
export function StationSearchField(props: StationSearchProps & {
  buttonRef?: RefObject<HTMLButtonElement | null>;
  autoOpen?: boolean;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(Boolean(props.autoOpen));
  const [host, setHost] = useState<Element | null>(null);
  const selected = props.selectedId ? STATIONS[props.selectedId] : null;
  useEffect(() => setHost(document.querySelector(".app-shell")), []);
  return (
    <div className="station-combobox">
      <button
        ref={props.buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={`${t(props.label)}: ${selected?.name ?? t("Choose station")}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className={styles.fieldLabel}>{t(props.label)}</span>
        <span className={selected ? styles.fieldValue : styles.fieldPlaceholder}>{selected?.name ?? t("Choose station")}</span>
        <Icon name="chev" size="xs" />
      </button>
      {open && host && createPortal(
        <StationSearchPage {...props} onClose={() => setOpen(false)} />,
        host,
      )}
    </div>
  );
}

function StationSearchPage({ label, selectedId, nearbyStationId, recentIds, locationStatus, onRetryLocation, onSelect, onClose }: StationSearchProps & { onClose: () => void }) {
  const { t } = useLocale();
  const titleId = useId();
  const listId = `${titleId}-results`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose, inputRef);
  const groups = useMemo(() => stationSearchGroups(query, nearbyStationId, recentIds), [query, nearbyStationId, recentIds]);
  const suggestions = useMemo(() => groups.flatMap((group) => group.stations), [groups]);
  const activeStation = suggestions[activeIndex];

  useEffect(() => setActiveIndex(-1), [query, nearbyStationId, recentIds]);
  useEffect(() => {
    if (activeStation) document.getElementById(`${listId}-${activeStation.id}`)?.scrollIntoView({ block: "nearest" });
  }, [activeStation, listId]);

  const commit = (id: string | null) => {
    onClose();
    // Dialog cleanup restores the launching field first; advance afterward.
    requestAnimationFrame(() => requestAnimationFrame(() => onSelect(id, true)));
  };

  return (
    <div ref={dialogRef} className={styles.page} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
      <header className={styles.header}>
        <IconButton name="back" label={`Back from ${label.toLowerCase()} station search`} onClick={onClose} />
        <h1 id={titleId}><T text="Select {field}" values={{ field: t(label) }} /></h1>
      </header>
      <div className={styles.search}>
        <Icon name="search" size="sm" />
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder={t("Search station")}
          aria-label={t("Search station")}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeStation ? `${listId}-${activeStation.id}` : undefined}
          value={query}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => event.key === "ArrowDown"
                ? Math.min(index + 1, suggestions.length - 1)
                : index <= 0 ? suggestions.length - 1 : index - 1);
            } else if (event.key === "Enter" && suggestions[Math.max(activeIndex, 0)]) {
              event.preventDefault();
              commit(suggestions[Math.max(activeIndex, 0)].id);
            }
          }}
        />
        {query && <IconButton name="x" label="Clear station search" onClick={() => { setQuery(""); inputRef.current?.focus(); }} />}
      </div>
      <p className={styles.hint}><T text={"Station name in English or Korean"} /></p>
      <div className={styles.results}>
        {!query.trim() && locationStatus !== "granted" && (
          <div className={styles.location}>
            <span>{t(locationStatus === "loading" ? "Finding nearby stations…" : locationStatus === "fallback" ? "Location unavailable" : "Find stations near you")}</span>
            {locationStatus !== "loading" && <button type="button" onClick={onRetryLocation}>{t(locationStatus === "fallback" ? "Retry" : "Use location")}</button>}
          </div>
        )}
        <div id={listId} role="listbox" aria-label={`${label} station results`}>
          {groups.map((group) => (
            <div key={group.label} role="group" aria-label={t(group.label)} className={styles.group}>
              <h2>{t(group.label)}</h2>
              {group.stations.map((station) => (
                <button
                  type="button"
                  id={`${listId}-${station.id}`}
                  key={station.id}
                  role="option"
                  tabIndex={-1}
                  aria-selected={selectedId === station.id}
                  className={`${styles.option}${activeStation?.id === station.id ? ` ${styles.active}` : ""}`}
                  onClick={() => commit(station.id)}
                >
                  <span className={styles.name}><b>{station.name}</b><span lang="ko">{station.nameKr}</span></span>
                  <span className={styles.lines} aria-label={station.lines.map((line) => LINE_META[line].label).join(", ")}>
                    {station.lines.map((line) => <span key={line} style={{ background: LINE_META[line].color, color: lineTextColor(LINE_META[line].color) }}>{LINE_META[line].shortLabel}</span>)}
                  </span>
                  {selectedId === station.id && <Icon name="check" size="sm" />}
                </button>
              ))}
            </div>
          ))}
        </div>
        {suggestions.length === 0 && <p className={styles.empty}><T text="No stations found. Try another name." /></p>}
        {!query.trim() && selectedId && <button type="button" className={styles.remove} onClick={() => commit(null)}><T text="Remove station" /></button>}
      </div>
      <span className="sr-only" aria-live="polite">{suggestions.length} stations</span>
    </div>
  );
}
