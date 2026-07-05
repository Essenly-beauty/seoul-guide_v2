"use client";

import { useState } from "react";

const ZONES = ["All", "Apgujeong · Cheongdam", "Gangnam", "Hongdae", "Myeongdong", "Jongno"];
const PRICES = ["₩", "₩₩", "₩₩₩"];
const SERVICES = ["Scalp", "Aroma", "Therapy"];

export function CategoryFilters() {
  const [zone, setZone] = useState("All");
  const [prices, setPrices] = useState<Set<string>>(new Set());
  const [services, setServices] = useState<Set<string>>(new Set());

  function toggle(set: Set<string>, val: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    setter(next);
  }

  return (
    <>
      <div className="chiprow">
        {ZONES.map((z) => (
          <button key={z} className={"chip" + (zone === z ? " selected" : "")} aria-pressed={zone === z} onClick={() => setZone(z)}>
            {z}
          </button>
        ))}
      </div>
      <div className="chiprow" style={{ alignItems: "center" }}>
        <span className="label" style={{ alignSelf: "center" }}>PRICE</span>
        {PRICES.map((p) => (
          <button key={p} className={"chip mono" + (prices.has(p) ? " selected" : "")} aria-pressed={prices.has(p)} onClick={() => toggle(prices, p, setPrices)}>
            {p}
          </button>
        ))}
        <span className="label" style={{ alignSelf: "center", marginLeft: 8 }}>SERVICE</span>
        {SERVICES.map((s) => (
          <button key={s} className={"chip" + (services.has(s) ? " selected" : "")} aria-pressed={services.has(s)} onClick={() => toggle(services, s, setServices)}>
            {s}
          </button>
        ))}
      </div>
    </>
  );
}
