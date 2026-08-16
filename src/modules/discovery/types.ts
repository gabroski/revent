export type City = {
  id: string;
  slug: string;
  name_ka: string;
  name_en: string;
};

export type Category = {
  id: string;
  slug: string;
  name_ka: string;
  name_en: string;
  icon: string;
  sort_order: number;
};

export type VenueRef = {
  id: string;
  slug: string;
  name_ka: string | null;
  name_en: string | null;
  is_verified: boolean;
};

export type EventListItem = {
  id: string;
  slug: string;
  title_ka: string | null;
  title_en: string | null;
  starts_at: string;
  poster_image_path: string;
  entry_fee_gel: number | null;
  favorite_count: number;
  venue: VenueRef;
  city: City;
  category: Category;
};

export type EventDetail = EventListItem & {
  description_ka: string | null;
  description_en: string | null;
  ends_at: string | null;
  dress_code: string | null;
  view_count: number;
  venue: VenueRef & {
    description_ka: string | null;
    description_en: string | null;
    address_ka: string | null;
    address_en: string | null;
    phone: string | null;
    website: string | null;
    instagram: string | null;
    facebook: string | null;
  };
  images: { id: string; image_path: string; position: number }[];
};

export type VenueDetail = {
  id: string;
  slug: string;
  name_ka: string | null;
  name_en: string | null;
  description_ka: string | null;
  description_en: string | null;
  address_ka: string | null;
  address_en: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  cover_image_path: string | null;
  is_verified: boolean;
  city: City;
};
