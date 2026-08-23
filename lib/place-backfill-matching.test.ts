import { describe, it, expect } from "vitest";
import { uniformHours, weekHours, weekRanges } from "../scripts/lib/kakao-local.mjs";
import { nameSimilarity, romanize, stripBranch, nameEvidence } from "../scripts/lib/hangul-romanize.mjs";

/** The two judgement calls the Kakao backfills make, tested away from the
 *  network. Both are accuracy-critical in the same way: the failure mode is
 *  not a crash, it is a plausible-looking wrong value rendered as fact —
 *  Saturday's hours printed as today's, or the shop next door's Korean name
 *  handed to a taxi driver.
 *
 *  Fixtures below are trimmed from real place-api.map.kakao.com/places/panel3
 *  responses captured 2026-08-23. */

const day = (desc: string, range: string | null) => ({
  day_of_the_week_desc: desc,
  ...(range ? { on_days: { start_end_time_desc: range } } : { off_days: {} }),
});
const panel = (ranges: (string | null)[]) => ({
  open_hours: {
    week_from_today: {
      week_periods: [{ days: ranges.map((r, i) => day(`d${i}`, r)) }],
    },
  },
});

describe("open_hours → Place.hours", () => {
  it("accepts a week where every open day is identical", () => {
    // 올리브영 명동타운, the shape 137 of the 239 Olive Young stores have
    const got = uniformHours(panel(Array(7).fill("10:00 ~ 22:30")));
    expect(got.skip).toBeUndefined();
    expect(got.hours).toEqual({ open: "10:00", close: "22:30" });
    expect(got.openDays).toBe(7);
  });

  it("accepts a closed-on-Mondays place — an off day is not a disagreement", () => {
    const got = uniformHours(panel(["11:00 ~ 21:00", null, ...Array(5).fill("11:00 ~ 21:00")]));
    expect(got.skip).toBeUndefined();
    expect(got.hours).toEqual({ open: "11:00", close: "21:00" });
    expect(got.openDays).toBe(6);
  });

  it("refuses a week whose weekend differs from its weekdays", () => {
    // 올리브영 학동중앙점: Mon–Fri 09:00, Sat/Sun 10:00. A single pair prints
    // against all seven weekdays, so flattening this would state Sunday's
    // opening time incorrectly — it goes in as a `week` instead (below).
    const got = uniformHours(
      panel(["10:00 ~ 22:30", ...Array(5).fill("09:00 ~ 22:30"), "10:00 ~ 22:30"]),
    );
    expect(got.hours).toBeUndefined();
    expect(got.skip).toMatch(/^varies-by-day/);
  });

  it("refuses a place open too few days to characterise", () => {
    const got = uniformHours(panel([null, null, null, "10:00 ~ 18:00", "10:00 ~ 18:00", null, null]));
    expect(got.hours).toBeUndefined();
    expect(got.skip).toBe("open-only-2-days");
  });

  it("refuses free-text hours instead of guessing at them", () => {
    const got = uniformHours(panel([...Array(6).fill("10:00 ~ 22:00"), "24시간 영업"]));
    expect(got.hours).toBeUndefined();
    expect(got.skip).toMatch(/^unparsed:/);
  });

  it("refuses a panel with no open_hours at all", () => {
    expect(uniformHours({}).skip).toBe("no-open-hours");
    expect(uniformHours(null).skip).toBe("no-open-hours");
  });

  it("pads a single-digit hour so the string sorts and compares", () => {
    const got = uniformHours(panel(Array(7).fill("9:30 ~ 21:00")));
    expect(got.hours).toEqual({ open: "09:30", close: "21:00" });
  });

  it("reads each day out of the panel, marking the closed ones", () => {
    const week = weekRanges(panel(["10:00 ~ 20:00", null, "10:00 ~ 20:00", null, null, null, null]));
    expect(week).not.toBeNull();
    expect(week!).toHaveLength(7);
    expect(week![0].range).toEqual({ open: "10:00", close: "20:00" });
    expect(week![1].range).toBeNull();
    expect(week![1].raw).toBe("off");
  });
});

// ── open_hours → Place.hours { week } ───────────────────────
/** Kakao serves the week starting at the day it was fetched, so a real panel's
 *  first entry is whatever today happened to be. `startAt` reproduces that
 *  rotation; `ranges` stays in Sunday-first order for readability. */
const KO = "일월화수목금토";
const koPanel = (ranges: (string | null)[], startAt = 0) => ({
  open_hours: {
    week_from_today: {
      week_periods: [{
        days: ranges.map((_, i) => {
          const d = (startAt + i) % 7;
          return day(`${KO[d]}(8/${23 + i})`, ranges[d]);
        }),
      }],
    },
  },
});

/** 올리브영 학동중앙점 — the exact split 122 backfilled rows have. */
const OY_WEEK = ["10:00 ~ 22:30", ...Array(5).fill("09:00 ~ 22:30"), "10:00 ~ 22:30"];

describe("open_hours → Place.hours { week }", () => {
  it("keeps a weekday/weekend split instead of throwing the row away", () => {
    const got = weekHours(koPanel(OY_WEEK));
    expect(got.skip).toBeUndefined();
    expect(got.openDays).toBe(7);
    expect(got.week).toEqual([
      { open: "10:00", close: "22:30" }, // Sun
      ...Array(5).fill({ open: "09:00", close: "22:30" }), // Mon–Fri
      { open: "10:00", close: "22:30" }, // Sat
    ]);
  });

  it("places every day by its own weekday letter, not by position", () => {
    // The panel is "week from today": fetched on a Thursday it starts at 목.
    // Reading it positionally would shift the whole week by four days.
    for (let startAt = 0; startAt < 7; startAt++) {
      expect(weekHours(koPanel(OY_WEEK, startAt)).week, `starting at ${KO[startAt]}`)
        .toEqual(weekHours(koPanel(OY_WEEK)).week);
    }
  });

  it("marks a closed day null rather than repeating a neighbour's hours", () => {
    const got = weekHours(koPanel([
      "10:30 ~ 20:00", "10:30 ~ 20:00", null, "10:30 ~ 20:00",
      "10:30 ~ 20:00", "10:30 ~ 20:00", "10:00 ~ 20:00",
    ]));
    expect(got.skip).toBeUndefined();
    expect(got.week![2]).toBeNull(); // Tuesday
    expect(got.openDays).toBe(6);
  });

  it("accepts a week too sparse for a single pair — `week` can say it honestly", () => {
    // uniformHours refuses this at minOpenDays; a per-day week does not have to.
    const ranges = [null, null, null, "10:00 ~ 18:00", "10:00 ~ 18:00", null, null];
    expect(uniformHours(panel(ranges)).skip).toBe("open-only-2-days");
    const got = weekHours(koPanel(ranges));
    expect(got.skip).toBeUndefined();
    expect(got.openDays).toBe(2);
  });

  it("refuses a partial week rather than calling the missing days closed", () => {
    const three = {
      open_hours: { week_from_today: { week_periods: [{ days: [
        day("목(8/27)", "10:00 ~ 18:00"), day("금(8/28)", "10:00 ~ 18:00"), day("토(8/29)", null),
      ] }] } },
    };
    expect(weekHours(three).week).toBeUndefined();
    expect(weekHours(three).skip).toBe("partial-week-3-days");
  });

  it("refuses a day it cannot place on the calendar", () => {
    expect(weekHours(panel(Array(7).fill("10:00 ~ 20:00"))).skip).toMatch(/^unknown-weekday:/);
  });

  it("refuses free-text hours and a panel with no open_hours, same as the pair", () => {
    expect(weekHours(koPanel([...Array(6).fill("10:00 ~ 22:00"), "24시간 영업"])).skip).toMatch(/^unparsed:/);
    expect(weekHours({}).skip).toBe("no-open-hours");
    expect(weekHours(null).skip).toBe("no-open-hours");
  });

  it("refuses a week with no open day at all — that is not hours, it is silence", () => {
    expect(weekHours(koPanel(Array(7).fill(null))).skip).toBe("open-only-0-days");
  });
});

describe("romanized name similarity", () => {
  it("romanizes Hangul with Revised Romanization", () => {
    expect(romanize("준오헤어")).toBe("junoheeo");
    expect(romanize("강남")).toBe("gangnam");
    expect(romanize("SJ헤어")).toBe("SJheeo");
  });

  it("strips the Kakao branch suffix our English names never carry", () => {
    expect(stripBranch("로나 청담본점")).toBe("로나");
    expect(stripBranch("이철헤어커커 강남점")).toBe("이철헤어커커");
    expect(stripBranch("준오헤어 강남역4호점")).toBe("준오헤어");
    expect(stripBranch("프로젝트흰")).toBe("프로젝트흰"); // nothing to strip
  });

  // The 0.55 auto-apply bar in scripts/backfill-kr-names-2.mjs. Each pair below
  // was hand-checked against the Kakao listing before the pass was applied.
  const AUTO_BAR = 0.55;

  it.each([
    ["Commenana Cheongdam Branch", "꼼나나 청담점"],
    ["Nanalog Seongsu Branch", "나나로그 성수점"],
    ["Ravi Hair Hongdae Main Branch", "라비헤어 홍대본점"],
    ["Rec.tor Seoul", "렉터 서울"],
    ["Kangeun Gangnam Hair Makeup", "강은"],
    ["Onyad Apgujeong Rodeo Branch", "온야드 압구정로데오점"],
    ["Park Seung Chol Hair Studio Hongdae", "박승철헤어스투디오 홍대점"],
    ["Project Hin Seongsu Hair Makeup", "프로젝트흰"],
  ])("scores the verified match %s ↔ %s above the auto bar", (en, kr) => {
    expect(nameSimilarity(en, kr)).toBeGreaterThanOrEqual(AUTO_BAR);
  });

  // Every one of these was proposed by an earlier, looser version of the
  // scorer and rejected by hand. They are the regressions that matter.
  it.each([
    ["Duvel Hair Sungshin Women's University Branch", "한스헤어"],
    ["JUNO HAIR Hongdae Seogyo Tower Hair Color Bleach", "제오헤어 합정역점"],
    ["Lee Chul Hair Kerker Myeongdong 2 Branch", "온헤어 명동점"],
    ["HOSU DOSAN Konkuk Seongsu Branch K-pop Hair", "창성헤어라인"],
    ["The Dears Lotte Department Store Yeongdeungpo", "달려라레게"],
    ["Aknack Seongsu", "CHOP헤어 성수플래그십"],
    ["Cconte Apgujeong Rodeo Flagship", "초이진헤어 압구정로데오 본점"],
  ])("keeps the hand-rejected pair %s ↔ %s below the auto bar", (en, kr) => {
    expect(nameSimilarity(en, kr)).toBeLessThan(AUTO_BAR);
  });

  it("does not let two salons match on the generic half of their names", () => {
    // "헤어" folds to "hair", so a whole-name comparison would hand every
    // Korean salon a free overlap with every English one.
    expect(nameSimilarity("Anything Hair Salon", "다른헤어")).toBeLessThan(AUTO_BAR);
  });

  it("reports how much overlap a score actually rests on", () => {
    // 0.57 off two accidental bigrams is how "Soonsoo Celebrity" got matched
    // to 선화 청담, a different salon 66 m away.
    // The matcher scores the brand before the "|", which for this row is just
    // "Soonsoo" — five letters against 선화's five, two bigrams in common.
    const thin = nameEvidence("Soonsoo", "선화 청담");
    expect(thin.similarity).toBeGreaterThanOrEqual(AUTO_BAR);
    expect(thin.shared).toBeLessThan(3);

    const solid = nameEvidence("Nanalog Seongsu Branch", "나나로그 성수점");
    expect(solid.shared).toBeGreaterThanOrEqual(3);
  });
});
