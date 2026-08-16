import { describe, it, expect } from "vitest";
import { formatEventDate, formatPrice } from "./format";

describe("formatEventDate", () => {
  it("renders day and time for an English viewer", () => {
    const out = formatEventDate("2026-08-21T19:00:00+04:00", "en");
    expect(out).toContain("21");
    expect(out).toContain("19:00");
  });

  it("renders Georgian locale output", () => {
    const out = formatEventDate("2026-08-21T19:00:00+04:00", "ka");
    expect(out).toContain("19:00");
  });

  it("uses Georgian local time regardless of the runtime timezone", () => {
    // 19:00 UTC is 23:00 in Tbilisi — must not render as 19:00 on a UTC server.
    expect(formatEventDate("2026-08-21T19:00:00Z", "en")).toContain("23:00");
  });
});

describe("formatPrice", () => {
  it("labels a null fee as free", () => {
    expect(formatPrice(null, "en")).toBe("Free");
    expect(formatPrice(null, "ka")).toBe("უფასო");
  });

  it("renders lari amounts", () => {
    expect(formatPrice(20, "en")).toBe("20 GEL");
    expect(formatPrice(20, "ka")).toBe("20 ₾");
  });
});
