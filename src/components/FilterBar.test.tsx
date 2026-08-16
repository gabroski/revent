import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { FilterBar } from "./FilterBar";
import messages from "../../messages/en.json";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: replace }),
}));

const categories = [
  {
    id: "1",
    slug: "dj",
    name_ka: "დიჯეი",
    name_en: "DJ / club night",
    icon: "disc",
    sort_order: 1,
  },
  {
    id: "2",
    slug: "trivia",
    name_ka: "ქვიზი",
    name_en: "Trivia / quiz",
    icon: "brain",
    sort_order: 2,
  },
];

function renderBar(filters: Parameters<typeof FilterBar>[0]["filters"]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <FilterBar
        locale="en"
        categories={categories}
        filters={filters}
        basePath="/en/tbilisi"
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => replace.mockClear());

describe("FilterBar", () => {
  it("writes the selected category into the URL", () => {
    renderBar({ when: "any", freeOnly: false });
    fireEvent.click(screen.getByRole("button", { name: "DJ / club night" }));
    expect(replace).toHaveBeenCalledWith("/en/tbilisi?category=dj", { scroll: false });
  });

  it("toggles a selected category off rather than stacking filters", () => {
    renderBar({ categorySlug: "dj", when: "any", freeOnly: false });
    fireEvent.click(screen.getByRole("button", { name: "DJ / club night" }));
    expect(replace).toHaveBeenCalledWith("/en/tbilisi", { scroll: false });
  });

  it("drops the pagination cursor when a filter changes", () => {
    renderBar({ when: "any", freeOnly: false, cursor: "abc" });
    fireEvent.click(screen.getByRole("button", { name: "Free entry" }));
    expect(replace).toHaveBeenCalledWith("/en/tbilisi?free=1", { scroll: false });
  });

  it("preserves an active search query when a filter changes", () => {
    renderBar({ when: "any", freeOnly: false, q: "jazz" });
    fireEvent.click(screen.getByRole("button", { name: "Tonight" }));
    expect(replace).toHaveBeenCalledWith("/en/tbilisi?when=tonight&q=jazz", { scroll: false });
  });
});
