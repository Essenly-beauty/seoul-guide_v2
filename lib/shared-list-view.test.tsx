import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { resolveSharedListView } from "@/lib/shared-list-view";
import { SharedListAccessBanner } from "@/components/map/shared-list-access-banner";
import { SharedListReadyBanner } from "@/components/map/shared-list-ready-banner";

const id = "2f9c1a34-9c1d-4e7a-b1f2-3d4e5f607182";
const list = { id, title: "Seoul weekend", placeIds: ["namdaemun-market"], createdAt: "2026-09-26T00:00:00+00:00" };

describe("shared-list map entry", () => {
  it("keeps the ordinary guest map open without requesting a list", async () => {
    const read = vi.fn();
    expect(await resolveSharedListView(null, null, false, read)).toEqual({ status: "none" });
    expect(read).not.toHaveBeenCalled();
  });

  it("waits for auth resolution without requesting the list", async () => {
    const read = vi.fn();
    expect(await resolveSharedListView(id, null, true, read)).toEqual({ status: "loading" });
    expect(read).not.toHaveBeenCalled();
  });

  it("prompts a guest without requesting any private content", async () => {
    const read = vi.fn();
    expect(await resolveSharedListView(id, null, false, read)).toEqual({ status: "sign-in" });
    expect(read).not.toHaveBeenCalled();
  });

  it("rejects malformed IDs without opening the read endpoint", async () => {
    const read = vi.fn();
    expect(await resolveSharedListView("not-a-uuid", "member", false, read)).toEqual({ status: "unavailable" });
    expect(read).not.toHaveBeenCalled();
  });

  it("shows only the exact list returned to a signed-in member", async () => {
    const read = vi.fn().mockResolvedValue({ status: "ok", list });
    expect(await resolveSharedListView(id, "member", false, read)).toEqual({ status: "ok", list });
    expect(read).toHaveBeenCalledExactlyOnceWith(id);
  });

  it("keeps a revoked link distinct from a temporary failure", async () => {
    const missing = vi.fn().mockResolvedValue({ status: "unavailable" });
    const failed = vi.fn().mockResolvedValue({ status: "retry" });
    expect(await resolveSharedListView(id, "member", false, missing)).toEqual({ status: "unavailable" });
    expect(await resolveSharedListView(id, "member", false, failed)).toEqual({ status: "retry" });
  });
});

describe("shared-list access banner", () => {
  it("offers login and signup with a return to the same link", () => {
    const html = renderToStaticMarkup(createElement(SharedListAccessBanner, {
      id,
      view: { status: "sign-in" },
      onRetry: () => {},
    }));
    expect(html).toContain("Sign in to open this shared list");
    expect(html).toContain(`/login?next=%2Fmap%3Flist%3D${id}`);
    expect(html).toContain("/register?next=");
    expect(html).not.toContain("Seoul weekend");
  });

  it("does not call a revoked link a temporary outage", () => {
    const html = renderToStaticMarkup(createElement(SharedListAccessBanner, {
      id,
      view: { status: "unavailable" },
      onRetry: () => {},
    }));
    expect(html).toContain("This shared list isn&#x27;t available");
    expect(html).not.toContain("Try again");
  });

  it("offers retry for a temporary failure", () => {
    const html = renderToStaticMarkup(createElement(SharedListAccessBanner, {
      id,
      view: { status: "retry" },
      onRetry: () => {},
    }));
    expect(html).toContain("Try again");
    expect(html).not.toContain("This shared list isn&#x27;t available");
  });
});

describe("published-place boundary for an existing shared link", () => {
  it("keeps save-all available when the list has published places", () => {
    const html = renderToStaticMarkup(createElement(SharedListReadyBanner, {
      list,
      onSaveAll: () => {},
      onClose: () => {},
    }));
    expect(html).toContain("Save all");
    expect(html).toContain("1 place");
  });

  it("explains unavailable old places without offering a broken save-all action", () => {
    const html = renderToStaticMarkup(createElement(SharedListReadyBanner, {
      list: { ...list, placeIds: [], unavailablePlaceCount: 4 },
      onSaveAll: () => {},
      onClose: () => {},
    }));
    expect(html).toContain("Seoul weekend");
    expect(html).toContain("No places from this link are currently listed");
    expect(html).not.toContain("Save all");
  });
});
