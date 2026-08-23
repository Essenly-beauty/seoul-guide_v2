// Kakao Map data access, shared by scripts/backfill-hours.mjs and
// scripts/backfill-kr-names-2.mjs.
//
// Two different Kakao surfaces are involved, and they are NOT the same product:
//
//  1. dapi.kakao.com/v2/local/search/keyword.json — the documented Local REST
//     API, authenticated with the login app's REST API key (docs/auth-setup.md
//     §3.1, passed in as KAKAO_REST_API_KEY). Verified 2026-08-23, it returns
//     exactly twelve fields and NONE of them is opening hours:
//       address_name, category_group_code, category_group_name, category_name,
//       distance, id, phone, place_name, place_url, road_address_name, x, y
//     Same twelve for category.json; address.json returns even fewer. So the
//     Local API can give us the Korean name and a Kakao place id — never hours.
//
//  2. place-api.map.kakao.com/places/panel3/{id} — the JSON behind the public
//     place page the Local API itself links to via `place_url`
//     (http://place.map.kakao.com/{id}). This one DOES carry `open_hours` with
//     a day-by-day schedule. It is the same public Kakao Map surface
//     scripts/capture-kakao-oy.sh already reads, over HTTP instead of through a
//     headless browser. It takes no key but 406s unless Referer + pf + a
//     browser User-Agent are all present.
//
// All network access shells out to curl: node's undici fails on this network
// (ETIMEDOUT in happy-eyeballs) — same reason and same shape as
// scripts/build-station-exits.mjs.

import { execFileSync } from "node:child_process";

const PANEL_HEADERS = [
  "-H", "Referer: https://place.map.kakao.com/",
  "-H", "pf: web",
  "-H", "User-Agent: Mozilla/5.0",
];

function curlJson(args, { tries = 3 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const body = execFileSync("curl", ["-sS", "--max-time", "30", ...args], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
      return JSON.parse(body);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Local REST keyword search. `near` is optional; without it the search is national. */
export function searchKeyword(key, query, near, { radius = 500, size = 10 } = {}) {
  const args = [
    "-G", "https://dapi.kakao.com/v2/local/search/keyword.json",
    "--data-urlencode", `query=${query}`,
    "--data-urlencode", `size=${size}`,
    "-H", `Authorization: KakaoAK ${key}`,
  ];
  if (near) {
    args.push(
      "--data-urlencode", `x=${near.lng}`,
      "--data-urlencode", `y=${near.lat}`,
      "--data-urlencode", `radius=${radius}`,
      "--data-urlencode", "sort=distance",
    );
  }
  const json = curlJson(args);
  if (json.errorType) throw new Error(`kakao local: ${json.errorType} ${json.message ?? ""}`);
  return json.documents ?? [];
}

/** Public place panel. Returns null when Kakao has no panel for the id. */
export function placePanel(kakaoId) {
  try {
    return curlJson([`https://place-api.map.kakao.com/places/panel3/${kakaoId}`, ...PANEL_HEADERS]);
  } catch {
    return null;
  }
}

// ── open_hours → Place.hours ────────────────────────────────
// Shape (verified against several hundred live panels, 2026-08-23):
//   open_hours.week_from_today.week_periods[].days[] = {
//     day_of_the_week_desc: "일(8/23)",
//     on_days?:  { start_end_time_desc: "10:00 ~ 22:30", last_order_times_desc?: [...] },
//     off_days?: { ... }                        // closed that day
//   }
// `hours` in lib/data.ts is EITHER a single { open, close } pair (uniform week)
// or { week: [...7 days, Sunday-first] } (per-day). A non-uniform week goes in
// as `week` and MUST NOT be flattened to one pair — showing Saturday's hours on
// a Sunday is the same class of bug as an unknown name.
//
// `week_from_today` means the days arrive rotated to start at the fetch date,
// so nothing may be read positionally: every day carries its own Korean weekday
// letter and that is what weekHours() indexes by.

const TIME_RANGE_RE = /^(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})$/;
const pad = (t) => (t.length === 4 ? `0${t}` : t);

/** Every day's opening range, or null for a day the place is closed / unparseable. */
export function weekRanges(panel) {
  const periods = panel?.open_hours?.week_from_today?.week_periods;
  if (!Array.isArray(periods)) return null;
  const days = periods.flatMap((p) => p.days ?? []);
  if (days.length === 0) return null;
  return days.map((d) => {
    const desc = d.on_days?.start_end_time_desc;
    if (!desc) return { day: d.day_of_the_week_desc, range: null, raw: d.off_days ? "off" : null };
    const m = String(desc).trim().match(TIME_RANGE_RE);
    if (!m) return { day: d.day_of_the_week_desc, range: null, raw: String(desc).trim() };
    return { day: d.day_of_the_week_desc, range: { open: pad(m[1]), close: pad(m[2]) }, raw: String(desc).trim() };
  });
}

/**
 * Reduce a week to the single { open, close } the Place model can hold.
 * Accuracy-first: accepted only when every day the place is OPEN shares the
 * exact same range, and it is open on at least `minOpenDays` of the 7 — so a
 * closed-on-Mondays salon still resolves, but one whose weekend differs does
 * not. Returns { hours } or { skip: <reason> }.
 */
export function uniformHours(panel, { minOpenDays = 5 } = {}) {
  const week = weekRanges(panel);
  if (!week) return { skip: "no-open-hours" };
  const open = week.filter((d) => d.range);
  const unparsed = week.filter((d) => !d.range && d.raw && d.raw !== "off");
  if (unparsed.length > 0) return { skip: `unparsed:${unparsed[0].raw}` };
  if (open.length < minOpenDays) return { skip: `open-only-${open.length}-days` };
  const distinct = new Set(open.map((d) => `${d.range.open}-${d.range.close}`));
  if (distinct.size > 1) return { skip: `varies-by-day:${[...distinct].join("|")}` };
  return { hours: open[0].range, openDays: open.length };
}

/** Date#getDay() order, which is also the detail page's weekday table order. */
const KO_WEEKDAYS = "일월화수목금토";

/**
 * The whole week as Place.hours' per-day shape: a Sunday-first array of 7,
 * `null` for a day the place is closed. Returns { week, openDays } or
 * { skip: <reason> }.
 *
 * Accuracy-first in the two ways that matter here:
 *   - every day must be placed by its own weekday letter, and all seven must be
 *     present exactly once. A panel that lists only three days is not a week we
 *     know, and guessing the other four is the bug this whole model exists to
 *     avoid.
 *   - a free-text day ("24시간 영업") disqualifies the row, same as uniformHours.
 * There is no minimum open-day count: unlike a single pair, `week` can say
 * "closed Monday and Tuesday" honestly.
 */
export function weekHours(panel) {
  const days = weekRanges(panel);
  if (!days) return { skip: "no-open-hours" };
  const unparsed = days.filter((d) => !d.range && d.raw && d.raw !== "off");
  if (unparsed.length > 0) return { skip: `unparsed:${unparsed[0].raw}` };

  const week = new Array(7).fill(undefined);
  for (const d of days) {
    const i = KO_WEEKDAYS.indexOf(String(d.day ?? "").trim().slice(0, 1));
    if (i < 0) return { skip: `unknown-weekday:${d.day}` };
    if (week[i] !== undefined) return { skip: `duplicate-weekday:${d.day}` };
    week[i] = d.range ?? null;
  }
  if (week.some((d) => d === undefined)) return { skip: `partial-week-${days.length}-days` };

  const openDays = week.filter(Boolean).length;
  if (openDays === 0) return { skip: "open-only-0-days" };
  return { week, openDays };
}
