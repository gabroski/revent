import { describe, it, expect } from "vitest";
import { createPublicClient } from "./server";

// These tests require a running local Supabase (`npx supabase start` + `db reset`).
// They are skipped when it is unreachable rather than failing the suite, but they
// are NOT optional before deploying: they are the tests that catch a data leak.
const hasSupabase = process.env.REVENT_DB_AVAILABLE === "true";

describe.runIf(hasSupabase)("public read policies", () => {
  it("returns only future published events to anonymous readers", async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("events")
      .select("id, starts_at, is_published, deleted_at");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const row of data!) {
      expect(new Date(row.starts_at).getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
      expect(row.is_published).toBe(true);
      expect(row.deleted_at).toBeNull();
    }
  });

  it("refuses anonymous writes to events", async () => {
    const supabase = createPublicClient();
    const { error } = await supabase.from("events").insert({
      venue_id: "00000000-0000-0000-0000-000000000000",
      category_id: "00000000-0000-0000-0000-000000000000",
      city_id: "00000000-0000-0000-0000-000000000000",
      slug: "hacked",
      title_en: "Hacked",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      poster_image_path: "x.jpg",
    });
    expect(error).not.toBeNull();
  });

  it("hides profiles from anonymous readers", async () => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("profiles").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
