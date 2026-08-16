import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CSS = readFileSync(join(ROOT, "app/globals.css"), "utf8");

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

function classFragments(path: string) {
  const text = source(path);
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fragments: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isJsxAttribute(node)
      && ts.isIdentifier(node.name)
      && node.name.text === "className"
      && node.initializer
    ) {
      const initializer = node.initializer;
      if (ts.isStringLiteral(initializer)) {
        fragments.push(initializer.text);
      } else if (ts.isJsxExpression(initializer) && initializer.expression) {
        const collect = (child: ts.Node) => {
          if (
            ts.isStringLiteral(child)
            || ts.isNoSubstitutionTemplateLiteral(child)
            || ts.isTemplateHead(child)
            || ts.isTemplateMiddle(child)
            || ts.isTemplateTail(child)
          ) {
            fragments.push(child.text);
          }
          ts.forEachChild(child, collect);
        };
        collect(initializer.expression);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(file);
  return fragments;
}

const P3_RAW_CLASSES = new Set([
  "listrow",
  "overlay",
  "sheet",
  "mobile-search-field",
  "notification-switch",
  "banner",
  "empty",
  "avatar",
  "badge",
  "sec-divider",
]);
const P3_IMPLEMENTATIONS = new Set([
  "components/ui/avatar.tsx",
  "components/ui/badge.tsx",
  "components/ui/bottom-sheet.tsx",
  "components/ui/empty-state.tsx",
  "components/ui/list-row.tsx",
  "components/ui/notice.tsx",
  "components/ui/search-field.tsx",
  "components/ui/section-divider.tsx",
  "components/ui/switch.tsx",
]);

// These are reviewed product-specific compositions that the current primitive
// APIs cannot represent without changing the tap target, content wrapping, or
// multi-step sheet behavior. Freeze the exact fragment and count, not the file.
const P3_RAW_ALLOWANCES = new Map<string, number>([
  // Whole-row links and ActionButton/FeedbackLauncher wrappers.
  ["app/blog/page.tsx: listrow", 1],
  ["app/brand/[id]/page.tsx: listrow v2", 1],
  ["app/favorites/page.tsx: listrow", 1],
  ["app/favorites/page.tsx: listrow v2", 1],
  ["app/mypage/reviews/page.tsx: listrow v2 top", 1],
  ["app/ranking/page.tsx: listrow", 1],
  ["app/ranking/page.tsx: listrow v2", 1],
  ["app/search/page.tsx: listrow v2", 4],
  ["app/settings/page.tsx: listrow v2", 3],
  // Interactive empty state and a multi-step sheet with a bespoke header/footer.
  ["components/booking/booking-sheet.tsx: overlay", 1],
  ["components/booking/booking-sheet.tsx: sheet", 1],
  // Domain rows whose multiline or full-row behavior differs from ListRow v2.
  ["components/mypage/notifications-form.tsx: listrow v2", 1],
  ["components/place/place-detail-body.tsx: listrow", 3],
  ["components/product/product-detail-body.tsx: listrow product-detail-routine-link", 1],
]);

describe("design-system hardening contracts", () => {
  it("gives selected chips a contrasting focus-visible ring outside the control", () => {
    expect(CSS).toMatch(
      /\.chip(?:\[[^\]]+\]|\.[\w-]+)*:focus-visible[\s\S]*?outline:\s*2px solid var\(--focus-ring-inner\)[\s\S]*?outline-offset:\s*[1-9]\d*px[\s\S]*?box-shadow:\s*0 0 0 6px var\(--focus-ring-outer\)/,
    );
  });

  it("gives disabled icon buttons an explicit visual and pointer state", () => {
    expect(CSS).toMatch(
      /\.iconbtn(?::disabled|\[aria-disabled="true"\])[\s\S]*?color:\s*var\(--text-disabled\)[\s\S]*?cursor:\s*(?:default|not-allowed)/,
    );
  });

  it("gives disabled switches a distinct track and pointer state", () => {
    expect(CSS).toMatch(
      /\.notification-switch:disabled[\s\S]*?cursor:\s*(?:default|not-allowed)[\s\S]*?\.notification-switch:disabled \.notification-switch-track[\s\S]*?background:\s*var\(--bg-surface-sunken\)/,
    );
  });

  it("forwards supported event and accessibility props in every render branch", () => {
    const button = source("components/ui/button.tsx");
    const iconButton = source("components/ui/icon-button.tsx");
    const chip = source("components/ui/chip.tsx");

    expect(button.match(/onClick=\{onClick\}/g)).toHaveLength(3);
    expect(iconButton.match(/onClick=\{onClick\}/g)).toHaveLength(3);
    expect(chip).toMatch(/<span[^>]*\{\.\.\.rest\}/);
    expect(button).toMatch(/buttonRef\?:\s*Ref<HTMLButtonElement>/);
    expect(button).toMatch(/<button[^>]*ref=\{buttonRef\}/);
    expect(iconButton).toMatch(/buttonRef\?:\s*Ref<HTMLButtonElement>/);
    expect(iconButton).toMatch(/<button[^>]*ref=\{buttonRef\}/);
    expect(chip).toMatch(/buttonRef\?:\s*Ref<HTMLButtonElement>/);
    expect(chip).toMatch(/<button[^>]*ref=\{buttonRef\}/);
  });

  it("keeps static notices out of live regions and supports layout-preserving overrides", () => {
    const notice = source("components/ui/notice.tsx");

    expect(notice).not.toMatch(/role\s*=\s*"status"/);
    expect(notice).toMatch(/className\?:\s*string/);
    expect(notice).toMatch(/style\?:\s*CSSProperties/);
  });

  it("keeps BottomSheet visible titles and contextual accessible names connected", () => {
    const bottomSheet = source("components/ui/bottom-sheet.tsx");
    const channelSheet = source("components/booking/channel-sheet.tsx");
    const filterSheet = source("components/map/filter-sheet.tsx");

    expect(bottomSheet).toMatch(/ariaLabel\?:\s*string/);
    expect(bottomSheet).toMatch(/aria-labelledby/);
    expect(bottomSheet).toMatch(/<h2 id=\{titleId\}/);
    expect(bottomSheet).toMatch(/id=\{kickerId\}/);
    expect(channelSheet).toContain('title={place.name}');
    expect(channelSheet).toContain('kicker="Book via"');
    expect(filterSheet).toContain('kicker="Filters"');
  });

  it("lets SearchField preserve a contextual clear label and visual variant", () => {
    const searchField = source("components/ui/search-field.tsx");

    expect(searchField).toMatch(/clearLabel\?:\s*string/);
    expect(searchField).toMatch(/clearVariant\?:\s*"plain"\s*\|\s*"soft"\s*\|\s*"overlay"/);
  });

  it("does not retain migration comments contradicted by the current component APIs", () => {
    const allSources = [...tsxFiles("app"), ...tsxFiles("components")]
      .map(source)
      .join("\n");

    expect(allSources).not.toMatch(
      /raw (?:button|iconbtn|chip).*kept:[^\n]*(?:has no aria-|no href support|has no role\/tabIndex\/onKeyDown)/i,
    );
  });

  it("freezes reviewed raw P3 compositions by exact class fragment and count", () => {
    const occurrences = [...tsxFiles("app"), ...tsxFiles("components")]
      .filter((path) => path !== "app/design/page.tsx" && !P3_IMPLEMENTATIONS.has(path))
      .flatMap((path) =>
        classFragments(path)
          .filter((value) => value.split(/\s+/).some((token) => P3_RAW_CLASSES.has(token)))
          .map((value) => `${relative(ROOT, path)}: ${value}`),
      );
    const actual = new Map<string, number>();
    for (const occurrence of occurrences) {
      actual.set(occurrence, (actual.get(occurrence) ?? 0) + 1);
    }
    const sorted = (entries: Iterable<[string, number]>) =>
      [...entries].sort(([a], [b]) => a.localeCompare(b));

    expect(sorted(actual)).toEqual(sorted(P3_RAW_ALLOWANCES));
  });
});
