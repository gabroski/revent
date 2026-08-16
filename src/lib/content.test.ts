import { describe, it, expect } from "vitest";
import { pickContent } from "./content";

const bilingual = { title_ka: "ჯაზი", title_en: "Jazz" };
const georgianOnly = { title_ka: "ჯაზი", title_en: null };
const englishOnly = { title_ka: null, title_en: "Jazz" };
const empty = { title_ka: null, title_en: null };

describe("pickContent", () => {
  it("returns the requested locale when present", () => {
    expect(pickContent(bilingual, "title", "en")).toBe("Jazz");
    expect(pickContent(bilingual, "title", "ka")).toBe("ჯაზი");
  });

  it("falls back to the other locale rather than rendering blank", () => {
    expect(pickContent(georgianOnly, "title", "en")).toBe("ჯაზი");
    expect(pickContent(englishOnly, "title", "ka")).toBe("Jazz");
  });

  it("treats an empty string as absent", () => {
    expect(pickContent({ title_ka: "   ", title_en: "Jazz" }, "title", "ka")).toBe("Jazz");
  });

  it("returns null when neither locale has content", () => {
    expect(pickContent(empty, "title", "ka")).toBeNull();
  });
});
