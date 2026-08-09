import { describe, it, expect } from "vitest";
import {
  QUESTIONS,
  isAnswered,
  nextQuestion,
  profileCompleteness,
  questionFor,
  type Profile,
} from "./profile";

const empty = (over: Partial<Profile> = {}): Profile => ({
  interests: [],
  skinConcerns: [],
  hairConcerns: [],
  ...over,
});

const full = (): Profile =>
  empty({
    countryCode: "US",
    stayType: "tourist",
    interests: ["skin_clinic"],
    ageBand: "25-34",
    gender: "female",
    skinType: "dry",
    hairType: "wavy",
    preferredLang: "en",
    budgetBand: "₩₩",
  });

describe("profileCompleteness", () => {
  it("0 for an empty profile", () => expect(profileCompleteness(empty())).toBe(0));
  it("100 when all 9 core fields are answered", () => expect(profileCompleteness(full())).toBe(100));
  it("counts partial answers across the 9 fields", () => {
    // 3 of 9 answered → 33
    expect(profileCompleteness(empty({ countryCode: "JP", stayType: "resident", skinType: "oily" }))).toBe(33);
  });
  it("counts interests once at least one is picked", () => {
    expect(profileCompleteness(empty({ interests: ["hair_salon"] }))).toBe(11);
    expect(profileCompleteness(empty({ interests: ["hair_salon", "head_spa"] }))).toBe(11);
  });
  it("ignores non-core fields (concerns, stayUntil)", () => {
    expect(profileCompleteness(empty({ skinConcerns: ["acne"], stayUntil: "2026-08-01" }))).toBe(0);
  });
});

describe("nextQuestion ordering", () => {
  it("asks countryCode first on an empty profile", () => {
    expect(nextQuestion(empty())?.key).toBe("countryCode");
  });
  it("walks the QUESTIONS order as answers land", () => {
    expect(nextQuestion(empty({ countryCode: "US" }))?.key).toBe("stayType");
    expect(nextQuestion(empty({ countryCode: "US", stayType: "tourist" }))?.key).toBe("interests");
    expect(
      nextQuestion(empty({ countryCode: "US", stayType: "tourist", interests: ["etc"] }))?.key,
    ).toBe("ageBand");
  });
  it("returns null when everything is answered", () => {
    expect(nextQuestion(full())).toBeNull();
  });
  it("QUESTIONS covers each key exactly once, T1 before T2", () => {
    expect(QUESTIONS.map((q) => q.key)).toEqual([
      "countryCode", "stayType", "interests", "ageBand", "gender",
      "skinType", "hairType", "preferredLang", "budgetBand",
    ]);
    for (const q of QUESTIONS) {
      expect(q.options.length).toBeGreaterThan(1);
      expect(q.why.length).toBeGreaterThan(0);
      expect(questionFor(q.key)).toBe(q);
    }
  });
});

describe("priority queue", () => {
  it("queued key jumps the order when unanswered", () => {
    expect(nextQuestion(empty({ priorityKey: "skinType" }))?.key).toBe("skinType");
    expect(nextQuestion(empty({ priorityKey: "hairType" }))?.key).toBe("hairType");
  });
  it("answered priority key falls back to normal order", () => {
    expect(nextQuestion(empty({ priorityKey: "skinType", skinType: "dry" }))?.key).toBe("countryCode");
  });
  it("isAnswered drives the queue: interests need ≥1 value", () => {
    expect(isAnswered(empty(), "interests")).toBe(false);
    expect(isAnswered(empty({ interests: ["nail_lash"] }), "interests")).toBe(true);
    expect(nextQuestion(empty({ priorityKey: "interests" }))?.key).toBe("interests");
  });
});
