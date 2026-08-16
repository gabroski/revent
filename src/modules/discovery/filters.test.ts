import { describe, it, expect } from "vitest";
import {
  parseFilters,
  toSearchParams,
  resolveDateRange,
  sanitizeQuery,
} from "./filters";

describe("sanitizeQuery", () => {
  it("keeps Latin and Georgian letters, numbers and spaces", () => {
    expect(sanitizeQuery("Jazz Night 90")).toBe("Jazz Night 90");
    expect(sanitizeQuery("ჯაზის საღამო")).toBe("ჯაზის საღამო");
  });

  it("strips punctuation that trips the WAF", () => {
    expect(sanitizeQuery("'; drop table events;--")).toBe("drop table events");
  });

  it("collapses the whitespace left behind", () => {
    expect(sanitizeQuery("dj   ---   set")).toBe("dj set");
  });

  it("caps runaway input", () => {
    expect(sanitizeQuery("a".repeat(200))).toHaveLength(60);
  });

  it("returns an empty string when nothing survives", () => {
    expect(sanitizeQuery("!!!???")).toBe("");
  });
});

describe("parseFilters", () => {
  it("defaults to any date and no filters", () => {
    expect(parseFilters({})).toEqual({ when: "any", freeOnly: false });
  });

  it("reads known values from the query string", () => {
    expect(parseFilters({ category: "dj", when: "weekend", free: "1", q: "jazz" })).toEqual({
      categorySlug: "dj",
      when: "weekend",
      freeOnly: true,
      q: "jazz",
    });
  });

  it("ignores an unknown when value instead of throwing", () => {
    expect(parseFilters({ when: "next-century" }).when).toBe("any");
  });

  it("takes the first value when a param repeats", () => {
    expect(parseFilters({ category: ["dj", "trivia"] }).categorySlug).toBe("dj");
  });
});

describe("toSearchParams", () => {
  it("omits defaults so canonical URLs stay clean", () => {
    expect(toSearchParams({ when: "any", freeOnly: false }).toString()).toBe("");
  });

  it("round-trips a populated filter set", () => {
    const filters = { categorySlug: "dj", when: "tonight" as const, freeOnly: true, q: "set" };
    expect(parseFilters(Object.fromEntries(toSearchParams(filters)))).toEqual(filters);
  });
});

describe("resolveDateRange", () => {
  const now = new Date("2026-08-19T18:00:00+04:00"); // a Wednesday

  it("returns now with no upper bound for 'any'", () => {
    const range = resolveDateRange("any", now);
    expect(range.from).toEqual(now);
    expect(range.to).toBeNull();
  });

  it("ends 'tonight' at 6am the next morning, not midnight", () => {
    const range = resolveDateRange("tonight", now);
    expect(range.to!.toISOString()).toBe(new Date("2026-08-20T06:00:00+04:00").toISOString());
  });

  it("spans Friday 18:00 to Monday 06:00 for 'weekend'", () => {
    const range = resolveDateRange("weekend", now);
    expect(range.from.toISOString()).toBe(new Date("2026-08-21T18:00:00+04:00").toISOString());
    expect(range.to!.toISOString()).toBe(new Date("2026-08-24T06:00:00+04:00").toISOString());
  });

  it("never starts a range in the past", () => {
    const friday = new Date("2026-08-21T23:00:00+04:00");
    expect(resolveDateRange("weekend", friday).from).toEqual(friday);
  });

  it("treats a 01:00 browse as still being 'tonight'", () => {
    // A club night that started at 23:00 is still tonight to someone browsing at 01:00.
    const afterMidnight = new Date("2026-08-20T01:00:00+04:00");
    const range = resolveDateRange("tonight", afterMidnight);
    expect(range.to!.toISOString()).toBe(new Date("2026-08-20T06:00:00+04:00").toISOString());
  });
});
