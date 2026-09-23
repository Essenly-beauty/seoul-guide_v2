import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain-JS pipeline module shared with scripts/
import { englishizeName } from "../scripts/lib/hangul-romanize.mjs";

// scripts/build-oliveyoung-kakao.mjs and scripts/englishize-titles.mjs both run
// branch names through englishizeName. Until now nothing tested its suffix
// table, so two bugs shipped: 본점 was deleted outright, and the last three
// characters of 사거리점 were read as 거리점 ("street").
describe("englishizeName branch suffixes", () => {
  it("keeps 본점 as a discriminator instead of deleting it", () => {
    // "올리브영 명동본점" and "올리브영 명동점" are different stores; dropping
    // 본점 makes them the same English string.
    expect(englishizeName("명동본점")).toBe("Myeongdong Main");
    expect(englishizeName("명동본점")).not.toBe(englishizeName("명동점"));
  });

  it("does not invent a street out of an N-way intersection", () => {
    for (const kr of ["강북구청사거리점", "대림사거리점", "신대방삼거리점", "신정네거리점"]) {
      expect(englishizeName(kr)).toMatch(/ Intersection$/);
      expect(englishizeName(kr)).not.toMatch(/ St\.$/);
    }
  });

  it("still calls a real street a street", () => {
    expect(englishizeName("녹두거리점")).toBe("Nokdu St.");
  });

  it("reads 역점 and 구청점 the way a visitor would", () => {
    expect(englishizeName("동묘앞역점")).toBe("Dongmyoap Stn.");
    expect(englishizeName("강북구청점")).toBe("Gangbuk-gu Office");
  });
});
