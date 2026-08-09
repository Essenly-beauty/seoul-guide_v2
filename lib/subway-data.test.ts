import { describe, it, expect } from "vitest";
import data from "./subway-data.json";

type Edge = [string, string, string, number];
const stations = data.stations as Record<string, { name: string; nameKr: string; lat: number; lng: number; lines: string[]; transfer: boolean }>;
const edges = data.edges as Edge[];
const lines = data.lines as Record<string, { label: string; labelKr: string; color: string }>;

describe("subway-data integrity", () => {
  it("has metropolitan scale (500+ stations, 10+ lines)", () => {
    expect(Object.keys(stations).length).toBeGreaterThan(500);
    expect(Object.keys(lines).length).toBeGreaterThanOrEqual(10);
  });
  it("every edge endpoint and line exists; seconds positive", () => {
    for (const [a, b, ln, sec] of edges) {
      expect(stations[a], a).toBeDefined();
      expect(stations[b], b).toBeDefined();
      expect(lines[ln], ln).toBeDefined();
      expect(sec).toBeGreaterThan(0);
    }
  });
  it("every station has English name, Korean name, Seoul-region coords, valid lines", () => {
    for (const [id, s] of Object.entries(stations)) {
      expect(s.name, id).toMatch(/[A-Za-z]/);
      expect(s.nameKr, id).toBeTruthy();
      expect(s.lat, id).toBeGreaterThan(36.5); // 수도권+인천 남단 여유
      expect(s.lat, id).toBeLessThan(38.3);
      expect(s.lng, id).toBeGreaterThan(126.3);
      expect(s.lng, id).toBeLessThan(127.9);
      expect(s.lines.length, id).toBeGreaterThan(0);
      for (const ln of s.lines) expect(lines[ln], `${id}:${ln}`).toBeDefined();
      expect(s.transfer, id).toBe(s.lines.length > 1);
    }
  });
  it("graph is connected enough: gangnam reaches hongik_univ and myeongdong", () => {
    const adj = new Map<string, string[]>();
    for (const [a, b] of edges) {
      adj.set(a, [...(adj.get(a) ?? []), b]);
      adj.set(b, [...(adj.get(b) ?? []), a]);
    }
    const seen = new Set(["gangnam"]);
    const q = ["gangnam"];
    while (q.length) for (const n of adj.get(q.shift()!) ?? []) if (!seen.has(n)) { seen.add(n); q.push(n); }
    expect(seen.has("hongik_univ")).toBe(true);
    expect(seen.has("myeongdong")).toBe(true);
    expect(seen.size).toBeGreaterThan(400);
  });
  it("beauty-zone anchor stations exist with official English names", () => {
    expect(stations.gangnam?.name).toBe("Gangnam");
    expect(stations.nonhyeon?.name).toBe("Nonhyeon");
    expect(stations.apgujeong_rodeo?.name).toMatch(/Apgujeong.?Rodeo/i);
    expect(stations.konkuk_univ?.name).toMatch(/Konkuk/);
    expect(stations.myeongdong?.name).toBe("Myeongdong");
  });
  it("no GTX lines", () => {
    expect(Object.keys(lines).some((l) => /gtx/i.test(l))).toBe(false);
  });
  it("no leading/trailing whitespace in names", () => {
    for (const [id, s] of Object.entries(stations)) {
      expect(s.name, id).toBe(s.name.trim());
      expect(s.nameKr, id).toBe(s.nameKr.trim());
    }
  });
  it("line-9 west end topology is real (regression: Gimpo Airport fabricated edges)", () => {
    // Ground truth (verified against vuski nodeData.js/linkData.js, KRIC's
    // own 서울 도시철도 9호선 row for 김포공항, and public sources): Line 9's
    // western segment is 개화(Gaehwa) → 김포공항(Gimpo Int'l Airport) →
    // 공항시장(Airport Market) → 신방화(Sinbanghwa). Gimpo Int'l Airport is a
    // real Line 9 transfer station (also serving Line 5, Airport Railroad,
    // Gimpo Gold Line, Seohae Line) — not a fabricated interloper.
    const hasEdge = (a: string, b: string, line: string) =>
      edges.some(([x, y, l]) => l === line && ((x === a && y === b) || (x === b && y === a)));

    expect(stations.gimpo_int_l_airport?.lines).toContain("9");
    expect(hasEdge("gaehwa", "gimpo_int_l_airport", "9")).toBe(true);
    expect(hasEdge("gimpo_int_l_airport", "airport_market", "9")).toBe(true);
    expect(hasEdge("airport_market", "sinbanghwa", "9")).toBe(true);
    // The direct Gaehwa<->Airport Market edge hypothesized by the (incorrect)
    // review does not exist in reality — Gimpo Airport sits between them.
    expect(hasEdge("gaehwa", "airport_market", "9")).toBe(false);
  });

  it("keeps Gyeongui-Jungang Pungsan separate from Line 5 Hanam Pungsan", () => {
    const hasEdge = (a: string, b: string, line: string) =>
      edges.some(([x, y, l]) => l === line && ((x === a && y === b) || (x === b && y === a)));

    expect(stations.pungsan?.nameKr).toBe("풍산");
    expect(stations.pungsan?.lines).toEqual(["gyeongui_jungang"]);
    expect(stations.hanam_pungsan?.nameKr).toBe("하남풍산");
    expect(stations.hanam_pungsan?.lines).toEqual(["5"]);
    expect(hasEdge("pungsan", "ilsan", "gyeongui_jungang")).toBe(true);
    expect(hasEdge("baengma", "pungsan", "gyeongui_jungang")).toBe(true);
    expect(hasEdge("hanam_pungsan", "ilsan", "gyeongui_jungang")).toBe(false);
    expect(hasEdge("misa", "hanam_pungsan", "5")).toBe(true);
  });

  it("does not turn future extensions into fake transfer stations", () => {
    expect(stations.byeollaebyeolgaram?.lines).toEqual(["4"]);
    expect(stations.hanam_city_hall_deokpung_sinjang?.lines).toEqual(["5"]);
    expect(stations.isu?.lines).toEqual(expect.arrayContaining(["4", "7"]));
  });

  it("rejects implausibly long adjacent-station edges", () => {
    const toRad = (value: number) => value * Math.PI / 180;
    const distanceKm = (a: (typeof stations)[string], b: (typeof stations)[string]) => {
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const lat1 = toRad(a.lat);
      const lat2 = toRad(b.lat);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };

    for (const [a, b] of edges) {
      expect(distanceKm(stations[a], stations[b]), `${a}~${b}`).toBeLessThan(15);
    }
  });

  it("gives every operating station at least one graph edge", () => {
    const degree = new Map(Object.keys(stations).map((id) => [id, 0]));
    for (const [a, b] of edges) {
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    }

    for (const [id, count] of degree) expect(count, id).toBeGreaterThan(0);
  });

  it("has no disconnected component except the known Yeoncheon segment", () => {
    const adjacency = new Map<string, string[]>();
    for (const id of Object.keys(stations)) adjacency.set(id, []);
    for (const [a, b] of edges) {
      adjacency.get(a)!.push(b);
      adjacency.get(b)!.push(a);
    }

    const remaining = new Set(Object.keys(stations));
    const components: string[][] = [];
    while (remaining.size > 0) {
      const start = remaining.values().next().value!;
      const component: string[] = [];
      const queue = [start];
      remaining.delete(start);
      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);
        for (const neighbour of adjacency.get(current) ?? []) {
          if (!remaining.delete(neighbour)) continue;
          queue.push(neighbour);
        }
      }
      components.push(component.sort());
    }

    components.sort((a, b) => b.length - a.length);
    expect(components).toHaveLength(2);
    expect(components[1]).toEqual(["jeongok", "yeoncheon"]);
  });
});
