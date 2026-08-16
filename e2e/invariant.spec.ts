import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The load-bearing test of the whole project.
 *
 * A discovery site that shows last month's parties is dead on arrival, and one
 * that leaks drafts betrays the venues using it. The seed deliberately contains
 * a past event and an unpublished one; if anyone later loosens a query or an RLS
 * policy, this fails.
 */
test("no past or unpublished event is reachable from any public surface", async ({ page }) => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!serviceKey, "SUPABASE_SERVICE_ROLE_KEY not set");

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!);

  const { data: hidden } = await supabase
    .from("events")
    .select("slug, starts_at, is_published")
    .or(`starts_at.lt.${new Date().toISOString()},is_published.eq.false`);

  // The seed must contain trap rows, or this test proves nothing.
  expect(hidden!.length).toBeGreaterThan(0);

  for (const row of hidden!) {
    const response = await page.goto(`/en/events/${row.slug}`);
    expect(response?.status(), `${row.slug} must not be publicly reachable`).toBe(404);
  }

  for (const path of ["/en/tbilisi?when=any", "/en/tbilisi?when=week", "/en"]) {
    await page.goto(path);
    const html = await page.content();
    for (const row of hidden!) {
      expect(html, `${row.slug} must not appear on ${path}`).not.toContain(row.slug);
    }
  }
});
