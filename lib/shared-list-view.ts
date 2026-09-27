import { looksLikeListId } from "@/lib/shared-list-id";
import type { SharedList, SharedListFetch } from "@/lib/shared-lists";

export type SharedListView =
  | { status: "none" | "loading" | "sign-in" | "unavailable" | "retry" }
  | { status: "ok"; list: SharedList };

/** Decide access before fetching so guests never request list contents. */
export async function resolveSharedListView(
  id: string | null,
  viewerId: string | null,
  authLoading: boolean,
  readList: (id: string) => Promise<SharedListFetch>,
): Promise<SharedListView> {
  if (!id) return { status: "none" };
  if (!looksLikeListId(id)) return { status: "unavailable" };
  if (authLoading) return { status: "loading" };
  if (!viewerId) return { status: "sign-in" };
  return readList(id);
}
