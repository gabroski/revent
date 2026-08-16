import { describe, it, expect } from "vitest";
import { listEvents } from "./queries";

const hasSupabase = process.env.REVENT_DB_AVAILABLE === "true";

describe.runIf(hasSupabase)("search", () => {
  it("matches an English title substring", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false, q: "jazz" });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const haystack = `${item.title_ka ?? ""} ${item.title_en ?? ""}`.toLowerCase();
      expect(haystack).toContain("jazz");
    }
  });

  it("matches a Georgian title substring", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false, q: "ჯაზ" });
    expect(items.length).toBeGreaterThan(0);
  });

  it("returns an empty list for nonsense rather than throwing", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false, q: "qqqzzzxxx" });
    expect(items).toEqual([]);
  });

  it("does not break when the query contains SQL metacharacters", async () => {
    const { items } = await listEvents({
      when: "any",
      freeOnly: false,
      q: "'; drop table events;--",
    });
    expect(Array.isArray(items)).toBe(true);
  });

  it("never surfaces a past event through search", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false, q: "Past Event" });
    expect(items).toEqual([]);
  });
});
