import { test, expect } from "@playwright/test";

test("browse, filter, and open an event", async ({ page }) => {
  await page.goto("/en/tbilisi");
  await expect(page.getByRole("heading", { name: "Tbilisi", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "DJ / club night" }).click();
  await expect(page).toHaveURL(/category=dj/);

  await page.goBack();
  await expect(page).not.toHaveURL(/category=dj/);

  await page.locator("a[href*='/events/']").first().click();
  await expect(page).toHaveURL(/\/en\/events\//);
});

test("a filtered URL renders the same view after a reload", async ({ page }) => {
  await page.goto("/en/tbilisi?when=week&free=1");
  const countBefore = await page.locator("a[href*='/events/']").count();
  await page.reload();
  expect(await page.locator("a[href*='/events/']").count()).toBe(countBefore);
});

test("search narrows the list and stays in the URL", async ({ page }) => {
  await page.goto("/en/tbilisi");
  await page.getByRole("searchbox", { name: "Search events" }).fill("jazz");
  await expect(page).toHaveURL(/q=jazz/);
  await expect(page.locator("a[href*='/events/']").first()).toBeVisible();
});

test("locale switching keeps the user on the site", async ({ page }) => {
  await page.goto("/en/tbilisi");
  await page.getByRole("link", { name: "ქარ" }).click();
  await expect(page).toHaveURL(/\/ka/);
});

test("an unknown event slug returns a 404 status", async ({ page }) => {
  const response = await page.goto("/en/events/definitely-not-real-zzz");
  expect(response?.status()).toBe(404);
});

test("an unknown city slug returns a 404 status", async ({ page }) => {
  const response = await page.goto("/en/atlantis");
  expect(response?.status()).toBe(404);
});
