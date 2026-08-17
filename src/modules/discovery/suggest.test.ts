import { describe, it, expect } from "vitest";
import {
  EMPTY_SUGGESTIONS,
  MIN_QUERY_LENGTH,
  flattenSuggestions,
  getSuggestions,
  totalSuggestions,
  type SuggestionGroups,
} from "./suggest";

const groups: SuggestionGroups = {
  events: [
    { kind: "event", label: "Jazz Night", detail: "Fabrika · Tbilisi", href: "/en/events/a" },
    { kind: "event", label: "Late Night House", detail: "Dive Bar", href: "/en/events/b" },
  ],
  venues: [{ kind: "venue", label: "Bassiani", detail: "Tbilisi", href: "/en/venues/bassiani" }],
  categories: [
    { kind: "category", label: "Karaoke", detail: "", href: "/en/tbilisi?category=karaoke" },
  ],
};

describe("suggestion helpers", () => {
  it("counts across every group", () => {
    expect(totalSuggestions(groups)).toBe(4);
    expect(totalSuggestions(EMPTY_SUGGESTIONS)).toBe(0);
  });

  it("flattens in display order so keyboard index matches what is rendered", () => {
    const flat = flattenSuggestions(groups);
    expect(flat.map((s) => s.kind)).toEqual(["event", "event", "venue", "category"]);
    expect(flat[0].label).toBe("Jazz Night");
    expect(flat[3].label).toBe("Karaoke");
  });
});

const hasSupabase = process.env.REVENT_DB_AVAILABLE === "true";

describe.runIf(hasSupabase)("getSuggestions", () => {
  it("returns nothing for a query below the minimum length", async () => {
    const result = await getSuggestions("j", "en");
    expect(totalSuggestions(result)).toBe(0);
  });

  it("returns nothing for punctuation that sanitizes to empty", async () => {
    const result = await getSuggestions("!!!", "en");
    expect(totalSuggestions(result)).toBe(0);
  });

  it("suggests a matching event", async () => {
    const result = await getSuggestions("jazz", "en");
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events[0].href).toMatch(/^\/en\/events\//);
  });

  it("suggests a matching venue", async () => {
    const result = await getSuggestions("bassiani", "en");
    expect(result.venues.length).toBeGreaterThan(0);
    expect(result.venues[0].label.toLowerCase()).toContain("bassiani");
  });

  it("suggests a matching category", async () => {
    const result = await getSuggestions("karaoke", "en");
    expect(result.categories.length).toBeGreaterThan(0);
  });

  it("falls back to the other language for Georgian-only content", async () => {
    const result = await getSuggestions("ჯაზ", "en");
    // The Georgian-only event has no English title; it must still be labelled.
    for (const event of result.events) expect(event.label.length).toBeGreaterThan(0);
  });

  it("never suggests a past event", async () => {
    const result = await getSuggestions("past event", "en");
    expect(result.events).toHaveLength(0);
  });

  it("never suggests an unpublished event", async () => {
    const result = await getSuggestions("unpublished", "en");
    expect(result.events).toHaveLength(0);
  });

  it("survives a query full of SQL metacharacters", async () => {
    const result = await getSuggestions("'; drop table events;--", "en");
    expect(totalSuggestions(result)).toBeGreaterThanOrEqual(0);
  });

  it("exposes a sane minimum query length", () => {
    expect(MIN_QUERY_LENGTH).toBeGreaterThanOrEqual(2);
  });
});
