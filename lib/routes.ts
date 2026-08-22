/** Central route map — map-first IA (2026-07 redesign). */
export const routes = {
  welcome: "/",
  login: "/", // legacy alias — old references keep compiling
  splash: "/", // legacy alias
  signIn: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  onboardingMode: "/onboarding/mode",
  onboardingBasics: "/onboarding/basics",
  onboardingPhone: "/onboarding/phone",
  onboardingInterests: "/onboarding/interests",
  onboardingProfile: "/onboarding/beauty-profile",

  // Footer 5 tabs
  map: "/map",
  ranking: "/ranking",
  blog: "/blog",
  favorites: "/favorites",
  savedPlacesMap: "/map?saved=1",
  /** Open the map in subway mode focused on one station (station-first search). */
  subwayStation: (id: string) => `/map?mode=subway&station=${encodeURIComponent(id)}`,
  menu: "/menu",

  // Legacy aliases (redirect pages keep old deep links alive)
  home: "/map",
  spot: "/map",
  shop: "/ranking",
  journal: "/blog",
  mypage: "/menu",

  // Details
  shopItem: (id: string) => `/shop/${id}`,
  routine: "/shop/routine-filter",
  brand: (id: string) => `/brand/${id}`,
  placesCategory: (cat: string) => `/places/${cat}`,
  place: (id: string) => `/place/${id}`,
  search: "/search",
  download: "/download",
  blogArticle: (slug: string) => `/blog/${slug}`,
  journalArticle: (slug: string) => `/blog/${slug}`, // legacy alias

  // Menu-only screens
  reviews: "/mypage/reviews",
  review: (id: string) => `/mypage/reviews/${id}`,
  reviewEdit: (id: string) => `/mypage/reviews/${id}/edit`,
  reviewNew: "/mypage/reviews/new",
  notifications: "/mypage/notifications",
  settings: "/settings",
  settingsAccount: "/settings/account",
  settingsName: "/settings/account/name",
  settingsEmail: "/settings/account/email",
  settingsApp: "/settings/app",
  settingsPrivacy: "/settings/privacy",
  support: "/support",
  legalTerms: "/legal/terms",
  legalPrivacy: "/legal/privacy",
  kitSurvey: "/kit/survey",
  kitStatus: "/kit",
  bookings: "/bookings",
  booking: (id: string) => `/bookings/${id}`,
  trip: "/trip",
} as const;

export const sample = {
  place: "juno-hair-gangnam",
  product: "cosrx-snail-mucin",
  journal: "korean-glass-skin-routine",
  booking: "HS-4F92A1",
} as const;
