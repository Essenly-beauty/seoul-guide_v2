import { afterEach, describe, expect, it, vi } from "vitest";
import { generateMetadata } from "@/app/map/page";

vi.mock("@/components/map/map-screen", () => ({ MapScreen: () => null }));
vi.mock("@/components/ui/bottom-nav", () => ({ BottomNav: () => null }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("public map preview", () => {
  it("does not fetch or reveal a shared list's title or place count", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://db.example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
    const fetch = vi.fn().mockResolvedValue(Response.json([{
      title: "Private Seoul weekend",
      place_ids: ["namdaemun-market"],
    }]));
    vi.stubGlobal("fetch", fetch);
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ list: "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182" }) });
    expect(metadata.title).toBe("Map — MYSEOULDROP");
    expect(JSON.stringify(metadata)).not.toContain("Private Seoul weekend");
    expect(JSON.stringify(metadata)).not.toContain("saved place");
    expect(fetch).not.toHaveBeenCalled();
  });
});
