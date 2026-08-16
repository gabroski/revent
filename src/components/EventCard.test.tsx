import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventCard } from "./EventCard";
import type { EventListItem } from "@/modules/discovery/types";

const base: EventListItem = {
  id: "1",
  slug: "jazz-night-abc123",
  title_ka: "ჯაზის საღამო",
  title_en: null,
  starts_at: "2026-08-21T19:00:00+04:00",
  poster_image_path: "posters/jazz.jpg",
  entry_fee_gel: null,
  favorite_count: 3,
  venue: {
    id: "v1",
    slug: "fabrika",
    name_ka: "ფაბრიკა",
    name_en: "Fabrika",
    is_verified: true,
  },
  city: { id: "c1", slug: "tbilisi", name_ka: "თბილისი", name_en: "Tbilisi" },
  category: {
    id: "cat1",
    slug: "live-music",
    name_ka: "ცოცხალი მუსიკა",
    name_en: "Live music",
    icon: "music",
    sort_order: 1,
  },
};

describe("EventCard", () => {
  it("falls back to the Georgian title for an English viewer", () => {
    render(<EventCard event={base} locale="en" />);
    expect(screen.getByText("ჯაზის საღამო")).toBeDefined();
  });

  it("links to the locale-prefixed event page", () => {
    render(<EventCard event={base} locale="en" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/en/events/jazz-night-abc123");
  });

  it("marks free entry", () => {
    render(<EventCard event={base} locale="en" />);
    expect(screen.getByText("Free")).toBeDefined();
  });

  it("shows the verified badge only for verified venues", () => {
    const { rerender } = render(<EventCard event={base} locale="en" />);
    expect(screen.queryByLabelText("Verified venue")).not.toBeNull();

    rerender(
      <EventCard
        event={{ ...base, venue: { ...base.venue, is_verified: false } }}
        locale="en"
      />,
    );
    expect(screen.queryByLabelText("Verified venue")).toBeNull();
  });
});
