import { describe, it, expect } from "vitest";
import { listEvents, getEventBySlug, listCities, listCategories } from "./queries";

// Requires a running local Supabase (`npx supabase start && npx supabase db reset`).
const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

describe.runIf(hasSupabase)("listEvents", () => {
  it("returns only future published events", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(new Date(item.starts_at).getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
    }
  });

  it("orders by start time ascending", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false });
    const times = items.map((i) => new Date(i.starts_at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("filters by city", async () => {
    const { items } = await listEvents({ citySlug: "batumi", when: "any", freeOnly: false });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.city.slug).toBe("batumi");
  });

  it("filters by category", async () => {
    const { items } = await listEvents({ categorySlug: "dj", when: "any", freeOnly: false });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.category.slug).toBe("dj");
  });

  it("returns only free events when freeOnly is set", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: true });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.entry_fee_gel).toBeNull();
  });

  it("paginates with a stable cursor and no duplicates", async () => {
    const page1 = await listEvents({ when: "any", freeOnly: false }, 2);
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listEvents(
      { when: "any", freeOnly: false, cursor: page1.nextCursor! },
      2,
    );
    const ids = new Set([...page1.items, ...page2.items].map((i) => i.id));
    expect(ids.size).toBe(page1.items.length + page2.items.length);
  });

  it("returns an empty page rather than throwing for an unknown city", async () => {
    const { items } = await listEvents({ citySlug: "atlantis", when: "any", freeOnly: false });
    expect(items).toEqual([]);
  });
});

describe.runIf(hasSupabase)("getEventBySlug", () => {
  it("returns null for an unknown slug", async () => {
    expect(await getEventBySlug("no-such-event-zzz")).toBeNull();
  });

  it("returns null for a past event even though the slug exists", async () => {
    expect(await getEventBySlug("past-event-must-not-appear-h7i8j9")).toBeNull();
  });

  it("returns null for an unpublished event even though the slug exists", async () => {
    expect(await getEventBySlug("unpublished-event-must-not-appear-k1l2m3")).toBeNull();
  });

  it("returns the event with its venue and city for a known slug", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false }, 1);
    const detail = await getEventBySlug(items[0].slug);
    expect(detail).not.toBeNull();
    expect(detail!.venue.slug).toBeTruthy();
    expect(detail!.city.slug).toBeTruthy();
  });
});

describe.runIf(hasSupabase)("reference data", () => {
  it("lists active cities", async () => {
    const cities = await listCities();
    expect(cities.map((c) => c.slug)).toContain("tbilisi");
  });

  it("lists categories in sort order", async () => {
    const categories = await listCategories();
    const order = categories.map((c) => c.sort_order);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
