import { describe, it, expect } from "vitest";
import { resolveActiveCity, CITY_COOKIE } from "./city-cookie";

const cities = [
  { id: "1", slug: "tbilisi", name_ka: "თბილისი", name_en: "Tbilisi" },
  { id: "2", slug: "batumi", name_ka: "ბათუმი", name_en: "Batumi" },
];

describe("resolveActiveCity", () => {
  it("uses the cookie value when it names a known city", () => {
    expect(resolveActiveCity("batumi", cities)!.slug).toBe("batumi");
  });

  it("defaults to Tbilisi when the cookie is absent", () => {
    expect(resolveActiveCity(undefined, cities)!.slug).toBe("tbilisi");
  });

  it("ignores an unknown cookie value rather than trusting it", () => {
    expect(resolveActiveCity("atlantis", cities)!.slug).toBe("tbilisi");
  });

  it("returns null when there are no cities at all", () => {
    expect(resolveActiveCity("tbilisi", [])).toBeNull();
  });

  it("exposes a stable cookie name", () => {
    expect(CITY_COOKIE).toBe("revent_city");
  });
});
