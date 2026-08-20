import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function readDeclaration(rule: string, property: string) {
  return rule.match(new RegExp(`(?:^|\\n)\\s*${property}:\\s*([^;]+);`))?.[1]?.trim();
}

describe("place detail collapse control layout", () => {
  it("keeps the collapse control equally inset from the top and left edges", () => {
    const rule = cssSource.match(/\.place-detail-collapse\s*\{[\s\S]*?\}/)?.[0] ?? "";
    const topInset = readDeclaration(rule, "top");
    const leftInset = readDeclaration(rule, "left");

    expect(topInset).toBeTruthy();
    expect(leftInset).toBe(topInset);
    expect(rule).not.toMatch(/(?:^|\n)\s*right:/);
  });
});
