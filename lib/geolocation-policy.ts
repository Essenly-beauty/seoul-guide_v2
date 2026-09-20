// When may the map ask the browser for a position without a user gesture?
// Only when the permission is already granted — then no prompt can appear.
// (web.dev permissions best practices; Apple HIG "ask in context".)

export type GeolocationPermission = "granted" | "prompt" | "denied" | "unsupported";

export async function readGeolocationPermission(nav: Navigator | undefined): Promise<GeolocationPermission> {
  try {
    const query = nav?.permissions?.query;
    if (typeof query !== "function") return "unsupported";
    const result = await query.call(nav!.permissions, { name: "geolocation" as PermissionName });
    const state = result?.state;
    return state === "granted" || state === "prompt" || state === "denied" ? state : "unsupported";
  } catch {
    // Older Safari rejects unknown descriptors; treat as "we cannot know".
    return "unsupported";
  }
}

export function autoRequestAllowed(state: GeolocationPermission): boolean {
  return state === "granted";
}
