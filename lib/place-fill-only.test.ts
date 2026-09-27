import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillEmptyValue, mergeFillOnlyPhotos } from "./place-fill-only";

describe("shared place fill-only contract", () => {
  it("pins the same contract used by A Drop of Seoul", () => {
    const policy = JSON.parse(readFileSync("data/place-data-fill-policy.json", "utf8"));
    expect(policy.contractId).toBe("seoul-place-fill-only-v1");
    expect(policy.fields.preserveNonEmptyExistingValues).toBe(true);
    expect(policy.photos.preserveExistingOrder).toBe(true);
    expect(policy.photos.targetMinimum).toBe(3);
    expect(policy.photos.targetMaximum).toBe(5);
  });

  it("fills empty values but preserves every non-empty service value", () => {
    expect(fillEmptyValue("Existing name", "Candidate name")).toBe("Existing name");
    expect(fillEmptyValue("", "Candidate name")).toBe("Candidate name");
  });

  it("keeps existing photo order and appends unique candidates up to five", () => {
    expect(mergeFillOnlyPhotos(["old-1", "old-2"], ["old-2", "new-3", "new-4", "new-5", "new-6"]))
      .toEqual(["old-1", "old-2", "new-3", "new-4", "new-5"]);
  });

  it("does not truncate a pre-existing gallery", () => {
    expect(mergeFillOnlyPhotos(["1", "2", "3", "4", "5", "6"], ["7"]))
      .toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});
