import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Next build artifact isolation", () => {
  it("keeps development output separate from production output", () => {
    const config = readFileSync("next.config.mjs", "utf8");

    expect(config).toContain(
      'distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next"',
    );
  });
});
