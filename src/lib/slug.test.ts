import { describe, it, expect } from "vitest";
import { transliterate, makeSlug } from "./slug";

describe("transliterate", () => {
  it("converts Mkhedruli to Latin", () => {
    expect(transliterate("თბილისი")).toBe("tbilisi");
    expect(transliterate("ღამის წვეულება")).toBe("ghamis tsveuleba");
  });

  it("leaves Latin text untouched", () => {
    expect(transliterate("Jazz Night")).toBe("Jazz Night");
  });
});

describe("makeSlug", () => {
  it("builds a lowercase hyphenated slug with the id suffix", () => {
    expect(makeSlug("Jazz Night at Fabrika", "a1b2c3")).toBe("jazz-night-at-fabrika-a1b2c3");
  });

  it("transliterates Georgian titles", () => {
    expect(makeSlug("ჯაზის საღამო", "x9y8z7")).toBe("jazis-saghamo-x9y8z7");
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(makeSlug("  DJ  Set: 90's  Party!! ", "zz11")).toBe("dj-set-90-s-party-zz11");
  });

  it("falls back to the id alone when the title has no slug-safe characters", () => {
    expect(makeSlug("!!!", "abc123")).toBe("abc123");
  });
});
