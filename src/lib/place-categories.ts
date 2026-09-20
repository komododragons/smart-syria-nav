/**
 * Structured public-place taxonomy (Phase 16).
 * Residential addresses are deliberately absent: a private home can never be
 * tagged with a public category, so it can never enter the public directory.
 */
export const PLACE_CATEGORIES = [
  { value: "hospital", ar: "مشافي", en: "Hospitals", emoji: "🏥" },
  { value: "pharmacy", ar: "صيدليات", en: "Pharmacies", emoji: "💊" },
  { value: "clinic", ar: "عيادات", en: "Clinics", emoji: "🩺" },
  { value: "school", ar: "مدارس", en: "Schools", emoji: "🏫" },
  { value: "university", ar: "جامعات", en: "Universities", emoji: "🎓" },
  { value: "government_office", ar: "دوائر حكومية", en: "Government offices", emoji: "🏛️" },
  { value: "bank", ar: "مصارف", en: "Banks", emoji: "🏦" },
  { value: "atm", ar: "صرافات آلية", en: "ATMs", emoji: "🏧" },
  { value: "hotel", ar: "فنادق", en: "Hotels", emoji: "🛎️" },
  { value: "restaurant", ar: "مطاعم", en: "Restaurants", emoji: "🍽️" },
  { value: "fuel_station", ar: "محطات وقود", en: "Fuel stations", emoji: "⛽" },
  { value: "factory", ar: "معامل", en: "Factories", emoji: "🏭" },
  { value: "warehouse", ar: "مستودعات", en: "Warehouses", emoji: "📦" },
  { value: "shopping_center", ar: "مراكز تسوق", en: "Shopping centers", emoji: "🛍️" },
  { value: "transport_hub", ar: "مراكز نقل", en: "Transport hubs", emoji: "🚌" },
  { value: "tourist_attraction", ar: "معالم سياحية", en: "Tourist attractions", emoji: "🗿" },
  { value: "public_facility", ar: "مرافق عامة", en: "Public facilities", emoji: "🚰" },
  { value: "emergency_facility", ar: "مرافق طوارئ", en: "Emergency facilities", emoji: "🚨" },
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number]["value"];

export const PLACE_CATEGORY_VALUES = PLACE_CATEGORIES.map((c) => c.value) as PlaceCategory[];

export const PLACE_CATEGORY_META: Record<string, { ar: string; en: string; emoji: string }> =
  Object.fromEntries(PLACE_CATEGORIES.map((c) => [c.value, { ar: c.ar, en: c.en, emoji: c.emoji }]));

export function placeCategoryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return PLACE_CATEGORY_META[value]?.ar ?? null;
}

/**
 * Node types that describe somewhere people live. They are excluded from every
 * public listing regardless of their visibility flag — privacy is layered.
 */
export const RESIDENTIAL_NODE_TYPES = ["apartment", "unit", "floor", "residence", "house"];
