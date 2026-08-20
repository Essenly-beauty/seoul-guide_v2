import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => {
  const url = new URL(`../${path}`, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
};

const detail = source("components/place/place-detail-body.tsx");
const launcher = source("components/place/place-correction-launcher.tsx");
const feedback = source("lib/feedback.ts");
const migration = source("supabase/migrations/0008_feedback_metadata.sql");

describe("structured place correction feedback", () => {
  it("offers focused correction types beside the provenance notice", () => {
    expect(detail).toContain("<PlaceCorrectionLauncher place={place}");
    for (const label of ["Wrong name", "Wrong location", "Wrong hours", "Closed day or holiday", "Other"]) {
      expect(launcher).toContain(label);
    }
    expect(launcher).toContain("Report incorrect info");
  });

  it("stores a queryable place correction through the real feedback channel", () => {
    expect(launcher).toContain("submitFeedback");
    expect(launcher).toContain('category: "place"');
    expect(launcher).toContain('kind: "place_correction"');
    expect(launcher).toContain("placeId: place.id");
    expect(launcher).toContain("issueType");
    expect(feedback).toContain("metadata?: FeedbackMetadata");
    expect(feedback).toContain("metadata: e.metadata ?? {}");
  });

  it("adds metadata without weakening insert-only RLS and explicitly grants inserts", () => {
    expect(migration).toContain("add column if not exists metadata jsonb");
    expect(migration).toContain("grant insert on table public.feedback to anon, authenticated");
    expect(migration).not.toContain("grant select");
  });

  it("keeps feedback writable while the metadata migration is still propagating", () => {
    expect(feedback).toContain("isMissingMetadataColumn");
    expect(feedback).toContain("legacyRows");
    expect(feedback).toContain('code === "PGRST204"');
    expect(feedback).toContain('code === "42703"');
  });
});
