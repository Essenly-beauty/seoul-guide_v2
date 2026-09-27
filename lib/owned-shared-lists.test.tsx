import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isCurrentOwnedListLoad, OwnedSharedListsView } from "@/components/favorites/owned-shared-lists";

const first = { id: "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182", title: "Seoul weekend", placeIds: ["namdaemun-market"], createdAt: "2026-09-26T00:00:00+00:00" };
const second = { id: "1f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182", title: "Beauty walk", placeIds: [], unavailablePlaceCount: 4, createdAt: "2026-09-25T00:00:00+00:00" };
const actions = { onCopy: () => {}, onAskRevoke: () => {}, onCancel: () => {}, onRevoke: () => {}, onRetry: () => {} };

function render(props: Partial<Parameters<typeof OwnedSharedListsView>[0]> = {}) {
  return renderToStaticMarkup(createElement(OwnedSharedListsView, {
    status: "ready",
    items: [first, second],
    confirmId: null,
    busy: false,
    ...actions,
    ...props,
  }));
}

describe("owned shared-link management", () => {
  it("ignores a list request that started before a successful revoke", () => {
    expect(isCurrentOwnedListLoad(true, 0, 0)).toBe(true);
    expect(isCurrentOwnedListLoad(true, 0, 1)).toBe(false);
    expect(isCurrentOwnedListLoad(false, 1, 1)).toBe(false);
  });

  it("shows existing links and copy actions independently of current favorites", () => {
    const html = render();
    expect(html).toContain("Your shared links");
    expect(html).toContain("Seoul weekend");
    expect(html).toContain("Beauty walk");
    expect(html).toContain("Copy link");
    expect(html).toContain(`/map?list=${first.id}`);
    expect(html).toContain("Created 2026-09-26");
    expect(html).toContain("0 available");
    expect(html).toContain("4 saved");
  });

  it("asks for explicit confirmation with the targeted title before revoke", () => {
    const html = render({ confirmId: first.id });
    expect(html).toContain("Revoke Seoul weekend?");
    expect(html).toContain("Cancel");
    expect(html).toContain("Revoke now");
    expect(html).toContain("Beauty walk");
  });

  it("distinguishes no links from a failed load", () => {
    expect(render({ items: [] })).toContain("No shared links yet");
    const html = render({ status: "error", items: [] });
    expect(html).toContain("Couldn&#x27;t load your links");
    expect(html).toContain("Try again");
    expect(html).not.toContain("No shared links yet");
  });
});
