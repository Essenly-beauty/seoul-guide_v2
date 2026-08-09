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
  onboardingInterests: "/onboarding/interests",
  onboardingProfile: "/onboarding/beauty-profile",

  // Footer 5 tabs
  map: "/map",
  ranking: "/ranking",
  blog: "/blog",
  favorites: "/favorites",
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
  blogArticle: (slug: string) => `/blog/${slug}`,
  journalArticle: (slug: string) => `/blog/${slug}`, // legacy alias

  // Menu-only screens
  reviews: "/mypage/reviews",
  reviewNew: "/mypage/reviews/new",
  notifications: "/mypage/notifications",
  settings: "/settings",
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
