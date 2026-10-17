import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import FavoritesPage from "@/app/favorites/page";

const mocks = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/lib/favorites", () => ({
  useFavorites: () => ({ place: [], product: [], article: [] }),
  useFavoritesReady: () => true,
}));
vi.mock("@/lib/auth/use-auth", () => ({
  useAuthUser: () => ({ user: mocks.user, loading: false }),
}));
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: vi.fn(), share: vi.fn() }),
}));

describe("Saved page shared-link section", () => {
  it("shows link management to a member even with no currently saved places", () => {
    mocks.user = { id: "member" };
    const html = renderToStaticMarkup(createElement(FavoritesPage));
    expect(html).toContain("Nothing saved yet");
    expect(html).toContain("Your shared links");
  });

  it("does not show account link management to a guest", () => {
    mocks.user = null;
    const html = renderToStaticMarkup(createElement(FavoritesPage));
    expect(html).not.toContain("Your shared links");
  });
});
