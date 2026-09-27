import { describe, expect, it } from "vitest";
import { PLACES } from "./data";

// The unreadable-name budget in place-name-en.test.ts measures token length,
// and length missed this whole class: "Olive Young Koekseumol" is ten letters
// and one word, and it is the COEX Mall flagship spelled by a syllable
// romaniser that had never heard of COEX. Fourteen such names reached
// production on 2026-09-27, every one a venue or chain whose real English
// spelling is on its own sign and already in scripts/lib/en-name-overrides.json
// for some other branch.
//
// So this checks meaning, not length: when the Korean name carries a venue or
// chain word, the English must carry that word's real spelling and not its
// romanisation. Each entry: the Korean host, the romanised form that betrays
// it, and the spelling the sign uses.
const HOSTS: [kr: string, romanised: RegExp, real: string][] = [
  ["코엑스", /koekseu/i, "COEX"],
  ["스퀘어", /seukw/i, "Square"],
  ["타워", /tawo/i, "Tower"],
  ["센터", /senteo/i, "Center"],
  ["플라자", /peul?laja/i, "Plaza"],
  ["백화점", /baekhwajeom/i, "Department Store"],
  ["아울렛", /aul+et/i, "Outlet"],
  ["스타필드", /seutapil/i, "Starfield"],
  ["아이파크", /aipakeu/i, "IPARK"],
  ["타운", /taun\b/i, "Town"],
  ["롯데", /rotde/i, "Lotte"],
  ["현대", /hyeondae/i, "Hyundai"],
  ["신세계", /sinsegye/i, "Shinsegae"],
  ["홈플러스", /hompeul/i, "Homeplus"],
  // 하이웨이마트 contains the substring 이마트 by accident of syllables; it is
  // Highway Mart, so it is matched first and the loop stops there.
  ["하이웨이마트", /haiwei/i, "Highway Mart"],
  ["이마트", /imateu/i, "Emart"],
  ["터미널", /teominal/i, "Terminal"],
  ["공항", /gonghang/i, "Airport"],
  ["애비뉴", /aebinyu/i, "Avenue"],
  ["파크", /pakeu/i, "Park"],
  ["시티", /siti/i, "City"],
  ["밸리", /baelri/i, "Valley"],
  ["팰리스", /paelriseu/i, "Palace"],
  ["몰", /mol\b/i, "Mall"],
];

describe("venue and chain words are spelled, not romanised", () => {
  it("leaves no store whose sign says COEX reading 'Koekseu'", () => {
    const retail = PLACES.filter((p) => p.type === "olive_young" || p.type === "daiso");
    const offenders: string[] = [];
    for (const p of retail) {
      for (const [kr, romanised, real] of HOSTS) {
        if (p.nameKr.includes(kr) && romanised.test(p.name)) {
          offenders.push(`${p.nameKr} -> "${p.name}" (should carry ${real})`);
          break;
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
