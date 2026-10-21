import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPendingFavoriteReturn, isSamePendingFavoriteReturn, peekPendingFavoriteReturn, setPendingFavoriteReturn, takePendingFavoriteReturn } from "./signup-return";

// The pre-signup heart is a stored save request. It must survive until the
// save it belongs to is confirmed — and an older save finishing late must not
// delete a newer request, even for the same place (codex review 2026-10-20).

const KEY = "myseouldrop.signup-return.favorite";

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

describe("pending favorite return", () => {
  it("gives each request its own id and peeks without consuming", () => {
    setPendingFavoriteReturn({ placeId: "x", placeName: "X" });
    const first = peekPendingFavoriteReturn();
    expect(first).toMatchObject({ placeId: "x", placeName: "X" });
    expect(typeof first?.requestId).toBe("string");
    expect(peekPendingFavoriteReturn()).toEqual(first);
  });

  it("clears only the request a completion belongs to — a later request for the SAME place survives", () => {
    setPendingFavoriteReturn({ placeId: "x", placeName: "X" });
    const askedByA = peekPendingFavoriteReturn()!;
    setPendingFavoriteReturn({ placeId: "x", placeName: "X" }); // visitor B hearts the same place after A signed out
    const askedByB = peekPendingFavoriteReturn()!;
    expect(askedByB.requestId).not.toBe(askedByA.requestId);
    clearPendingFavoriteReturn(askedByA); // A's late completion
    expect(peekPendingFavoriteReturn()).toEqual(askedByB);
    clearPendingFavoriteReturn(askedByB);
    expect(peekPendingFavoriteReturn()).toBeNull();
  });

  it("gives a request stored before ids existed its own id on first read, so a late completion never clears a newer request for the same place", () => {
    sessionStorage.setItem(KEY, JSON.stringify({ placeId: "x", placeName: "X" }));
    const legacy = peekPendingFavoriteReturn()!;
    expect(typeof legacy.requestId).toBe("string");
    expect(peekPendingFavoriteReturn()).toEqual(legacy); // the id is stored, not re-made on every read
    setPendingFavoriteReturn({ placeId: "x", placeName: "X" }); // a newer heart on the same place
    const newer = peekPendingFavoriteReturn()!;
    expect(newer.requestId).not.toBe(legacy.requestId);
    clearPendingFavoriteReturn(legacy); // the legacy request's late completion
    expect(peekPendingFavoriteReturn()).toEqual(newer);
  });

  it("compares by place only when neither side carries an id", () => {
    expect(isSamePendingFavoriteReturn({ placeId: "x", placeName: "X" }, { placeId: "x", placeName: "X" })).toBe(true);
    expect(isSamePendingFavoriteReturn({ placeId: "x", placeName: "X" }, { placeId: "y", placeName: "Y" })).toBe(false);
    expect(isSamePendingFavoriteReturn({ placeId: "x", placeName: "X", requestId: "a" }, { placeId: "x", placeName: "X", requestId: "b" })).toBe(false);
  });

  it("clears unconditionally without an expected request, and take() consumes", () => {
    setPendingFavoriteReturn({ placeId: "x", placeName: "X" });
    clearPendingFavoriteReturn();
    expect(peekPendingFavoriteReturn()).toBeNull();
    setPendingFavoriteReturn({ placeId: "x", placeName: "X" });
    expect(takePendingFavoriteReturn()).toMatchObject({ placeId: "x", placeName: "X" });
    expect(peekPendingFavoriteReturn()).toBeNull();
  });

  it("drops an unreadable value instead of retrying it forever", () => {
    sessionStorage.setItem(KEY, "{not json");
    expect(peekPendingFavoriteReturn()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});
