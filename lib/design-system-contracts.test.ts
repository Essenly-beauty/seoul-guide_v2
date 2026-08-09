import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function source(path: string) {
  return readFileSync(join(ROOT, path), "utf8");
}

function tsxFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    const absolute = join(ROOT, path);
    if (statSync(absolute).isDirectory()) return tsxFiles(path);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

function stringFragments(path: string) {
  const file = ts.createSourceFile(
    path,
    source(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fragments: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isStringLiteral(node)
      || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node)
      || ts.isTemplateMiddle(node)
      || ts.isTemplateTail(node)
    ) {
      fragments.push(node.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return fragments;
}

const RAW_CONTROL_CLASSES = new Set(["btn", "iconbtn", "chip"]);
const CONTROL_IMPLEMENTATIONS = new Set([
  "components/ui/button.tsx",
  "components/ui/chip.tsx",
  "components/ui/icon-button.tsx",
]);

// Filled only with reviewed product-specific wrappers that cannot yet express
// the same ref, side effect, or presentation through the core component API.
// The exact class fragment and count are the contract; files are never broadly
// exempted from future checks.
const RAW_CONTROL_ALLOWANCES = new Map<string, number>();

describe("design-system usage contract", () => {
  it("freezes reviewed raw control compositions by exact fragment and count", () => {
    const occurrences = [...tsxFiles("app"), ...tsxFiles("components")]
      .filter((path) => path !== "app/design/page.tsx" && !CONTROL_IMPLEMENTATIONS.has(path))
      .flatMap((path) =>
        stringFragments(path)
          .filter((value) =>
            value.split(/\s+/).some((token) => RAW_CONTROL_CLASSES.has(token)),
          )
          .map((value) => `${path}: ${value}`),
      );
    const actual = new Map<string, number>();
    for (const occurrence of occurrences) {
      actual.set(occurrence, (actual.get(occurrence) ?? 0) + 1);
    }
    const sorted = (entries: Iterable<[string, number]>) =>
      [...entries].sort(([a], [b]) => a.localeCompare(b));

    expect(sorted(actual)).toEqual(sorted(RAW_CONTROL_ALLOWANCES));
  });

  it("deprecated ghost/outline button classes do not come back", () => {
    const offenders = [...tsxFiles("app"), ...tsxFiles("components")]
      .filter((path) => /"btn (sm )?(ghost|outline)/.test(source(path)));
    expect(offenders).toEqual([]);
  });
});
