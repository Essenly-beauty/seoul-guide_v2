/** Central route map mirroring seoul-beauty-guide's information architecture. */
export const routes = {
  splash: "/",
  onboardingInterests: "/onboarding/interests",
  onboardingProfile: "/onboarding/beauty-profile",
  home: "/home",

  // Shop (products)
  shop: "/shop",
  shopItem: (id: string) => `/shop/${id}`,
  routine: "/shop/routine-filter",
  brand: (id: string) => `/brand/${id}`,

  // Spot (places)
  spot: "/places/spot",
  placesCategory: (cat: string) => `/places/${cat}`,
  place: (id: string) => `/place/${id}`,
  map: "/map",

  // Journal
  journal: "/journal",
  journalArticle: (slug: string) => `/journal/${slug}`,

  // My
  mypage: "/mypage",
  reviews: "/mypage/reviews",
  notifications: "/mypage/notifications",
  settings: "/settings",
  favorites: "/favorites",
  support: "/support",

  // Kit / bookings / trip (full scope, not MVP-hidden)
  kitSurvey: "/kit/survey",
  kitStatus: "/kit",
  bookings: "/bookings",
  booking: (id: string) => `/bookings/${id}`,
  trip: "/trip",
} as const;

/** Default sample identifiers used by links. */
export const sample = {
  place: "juno-hair-gangnam",
  product: "cosrx-snail-mucin",
  journal: "korean-glass-skin-routine",
  booking: "HS-4F92A1",
} as const;
