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
});
