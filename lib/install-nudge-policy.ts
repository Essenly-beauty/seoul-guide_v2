/** When to offer adding MYSEOULDROP to the Home Screen.
 *
 *  Installing is the only thing that removes the browser's own header and
 *  footer, and the app has been installable the whole time — manifest,
 *  standalone display, icons and service worker all shipped. What was missing
 *  was any way to find that out: the install guide sat behind the hamburger
 *  menu, which a first-time visitor has no reason to open.
 *
 *  The rules below are all refusals. The nudge is the exception, not the
 *  default, because an install prompt over an empty map asks for commitment
 *  before the app has shown it is worth keeping. */

/** Useful things done before the app asks for a place on the Home Screen —
 *  saving a place, opening directions. One is enough: the visitor has used
 *  the app for its purpose, which is the moment the offer makes sense. */
export const MIN_VALUE_MOMENTS = 1;

export type InstallNudgeState = {
  /** Already running from the Home Screen, so there is nothing to offer. */
  standalone: boolean;
  /** Turned it down once. Asking again is nagging. */
  dismissed: boolean;
  /** KakaoTalk, Naver, Instagram and the like. These have no install path at
   *  all, so an offer there leads nowhere. */
  inAppBrowser: boolean;
  valueMoments: number;
};

export function shouldOfferInstall(state: InstallNudgeState): boolean {
  if (state.standalone) return false;
  if (state.dismissed) return false;
  if (state.inAppBrowser) return false;
  return state.valueMoments >= MIN_VALUE_MOMENTS;
}
