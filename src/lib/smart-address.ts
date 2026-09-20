/**
 * Client-safe domain model for the Smart Address Network.
 * Node types, access purposes, verification levels and code formatting.
 */

export type Purpose =
  | "visitor"
  | "resident"
  | "parcel_delivery"
  | "food_delivery"
  | "freight"
  | "loading"
  | "taxi_pickup"
  | "taxi_dropoff"
  | "emergency"
  | "wheelchair_access"
  | "employee"
  | "customer"
  | "parking"
  | "service"
  | "maintenance"
  | "utility";

export const PURPOSES: { value: Purpose; ar: string; en: string }[] = [
  { value: "parcel_delivery", ar: "طرد بريدي", en: "Parcel delivery" },
  { value: "visitor", ar: "زائر", en: "Visitor" },
  { value: "freight", ar: "شحن ثقيل", en: "Freight" },
  { value: "emergency", ar: "إسعاف وطوارئ", en: "Emergency" },
  { value: "food_delivery", ar: "توصيل طعام", en: "Food delivery" },
  { value: "resident", ar: "ساكن", en: "Resident" },
  { value: "customer", ar: "مراجع / عميل", en: "Customer" },
  { value: "employee", ar: "موظف", en: "Employee" },
  { value: "loading", ar: "تحميل وتنزيل", en: "Loading" },
  { value: "taxi_pickup", ar: "نقطة صعود تكسي", en: "Taxi pickup" },
  { value: "taxi_dropoff", ar: "نقطة نزول تكسي", en: "Taxi drop-off" },
  { value: "wheelchair_access", ar: "وصول كرسي متحرك", en: "Wheelchair access" },
  { value: "parking", ar: "مواقف", en: "Parking" },
  { value: "service", ar: "خدمات", en: "Service" },
  { value: "maintenance", ar: "صيانة", en: "Maintenance" },
  { value: "utility", ar: "خدمات عامة", en: "Utility" },
];

export const PURPOSE_LABELS: Record<string, string> = Object.fromEntries(
  PURPOSES.map((p) => [p.value, p.ar]),
);

export const QUICK_PURPOSES: Purpose[] = [
  "parcel_delivery",
  "visitor",
  "freight",
  "emergency",
];

export const NODE_TYPES = [
  { value: "property", ar: "عقار / موقع" },
  { value: "land", ar: "أرض" },
  { value: "building", ar: "مبنى" },
  { value: "floor", ar: "طابق" },
  { value: "apartment", ar: "شقة" },
  { value: "office", ar: "مكتب" },
  { value: "shop", ar: "متجر" },
  { value: "clinic", ar: "عيادة" },
  { value: "warehouse", ar: "مستودع" },
  { value: "farm", ar: "مزرعة" },
  { value: "field", ar: "حقل" },
  { value: "factory", ar: "معمل" },
  { value: "school", ar: "مدرسة" },
  { value: "hospital", ar: "مشفى" },
  { value: "hotel", ar: "فندق" },
  { value: "government_office", ar: "مؤسسة حكومية" },
  { value: "pickup_point", ar: "نقطة استلام" },
  { value: "poi", ar: "نقطة اهتمام" },
  { value: "custom", ar: "أخرى" },
] as const;

export const NODE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  NODE_TYPES.map((n) => [n.value, n.ar]),
);

export const ACCESS_TYPES = [
  { value: "entrance", ar: "مدخل" },
  { value: "gate", ar: "بوابة" },
  { value: "delivery_point", ar: "مدخل توصيل" },
  { value: "loading_dock", ar: "رصيف تحميل" },
  { value: "service_entrance", ar: "مدخل خدمة" },
  { value: "parking_entrance", ar: "مدخل مواقف" },
  { value: "emergency_entrance", ar: "مدخل طوارئ" },
  { value: "staff_entrance", ar: "مدخل موظفين" },
] as const;

export const ACCESS_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ACCESS_TYPES.map((a) => [a.value, a.ar]),
);

export const RESTRICTION_LABELS: Record<string, string> = {
  no_deliveries: "ممنوع التوصيل",
  residents_only: "للسكان فقط",
  staff_only: "للموظفين فقط",
  closed_after_hours: "يُغلق بعد ساعات العمل",
  trucks_prohibited: "ممنوع دخول الشاحنات",
  pedestrian_only: "للمشاة فقط",
  vehicle_only: "للمركبات فقط",
  emergency_only: "للطوارئ فقط",
  temporary_closure: "إغلاق مؤقت",
};

export const VERIFICATION_LEVELS: Record<string, { ar: string; weight: number }> = {
  unverified: { ar: "غير موثق", weight: 0 },
  user_confirmed: { ar: "مؤكد من المالك", weight: 1 },
  community_confirmed: { ar: "مؤكد مجتمعياً", weight: 2 },
  courier_verified: { ar: "موثق من شركة توصيل", weight: 3 },
  business_verified: { ar: "عمل تجاري موثق", weight: 4 },
  organization_verified: { ar: "مؤسسة موثقة", weight: 5 },
  official_verified: { ar: "توثيق رسمي", weight: 6 },
};

export const ACCESSIBILITY_LABELS: Record<string, string> = {
  wheelchair_accessible: "مناسب لكرسي متحرك",
  ramp: "منحدر",
  elevator: "مصعد",
  stairs: "أدراج",
  accessible_parking: "موقف مخصص",
};

/** Community correction types. `field` drives what a moderator may apply
 *  after approval; corrections never overwrite verified data automatically. */
export const CORRECTION_TYPES = [
  {
    value: "wrong_location",
    ar: "الموقع على الخريطة خاطئ",
    field: "node_coordinates",
    valueLabel: "الإحداثيات الصحيحة (خط العرض، خط الطول)",
    placeholder: "33.5102, 36.2913",
  },
  {
    value: "wrong_business_name",
    ar: "اسم النشاط خاطئ",
    field: "business_name",
    valueLabel: "الاسم الصحيح",
    placeholder: "صيدلية النور",
  },
  {
    value: "business_closed",
    ar: "النشاط مغلق نهائياً",
    field: "business_status",
    valueLabel: null,
    placeholder: null,
  },
  {
    value: "entrance_changed",
    ar: "المدخل تغيّر",
    field: "entrance",
    valueLabel: "وصف المدخل الصحيح",
    placeholder: "المدخل الخلفي من شارع الثورة",
  },
  {
    value: "duplicate_location",
    ar: "موقع مكرر",
    field: "other",
    valueLabel: "رمز العنوان المكرر (إن وُجد)",
    placeholder: "SY-DAM-XXXX",
  },
  {
    value: "incorrect_category",
    ar: "التصنيف غير صحيح",
    field: "place_category",
    valueLabel: "التصنيف الصحيح",
    placeholder: "pharmacy",
  },
  {
    value: "access_issue",
    ar: "مشكلة في الوصول",
    field: "access",
    valueLabel: "ما المشكلة؟",
    placeholder: "البوابة مقفلة بعد الساعة 6 مساءً",
  },
  { value: "other", ar: "أخرى", field: "other", valueLabel: "الاقتراح", placeholder: null },
] as const;

/** Labels for every correction type, including legacy values on old reports. */
export const CORRECTION_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(CORRECTION_TYPES.map((t) => [t.value, t.ar])),
  wrong_building_pin: "موقع المبنى خاطئ",
  wrong_entrance: "المدخل خاطئ",
  entrance_closed: "المدخل مغلق",
  delivery_prohibited: "التوصيل ممنوع من هذا المدخل",
  wrong_floor: "الطابق خاطئ",
  business_moved: "العمل التجاري انتقل",
  incorrect_name: "الاسم غير صحيح",
  incorrect_hours: "ساعات العمل غير صحيحة",
  unsafe_access: "وصول غير آمن",
};

export const CORRECTION_DECISION_LABELS: Record<string, string> = {
  approved: "مقبول",
  rejected: "مرفوض",
  needs_more_info: "بحاجة لمعلومات إضافية",
};

export const GOVERNORATES = [
  { code: "DAM", ar: "دمشق" },
  { code: "RDA", ar: "ريف دمشق" },
  { code: "ALE", ar: "حلب" },
  { code: "HOM", ar: "حمص" },
  { code: "HAM", ar: "حماة" },
  { code: "LAT", ar: "اللاذقية" },
  { code: "TAR", ar: "طرطوس" },
  { code: "IDL", ar: "إدلب" },
  { code: "DAR", ar: "درعا" },
  { code: "SUW", ar: "السويداء" },
  { code: "QUN", ar: "القنيطرة" },
  { code: "RAQ", ar: "الرقة" },
  { code: "DEZ", ar: "دير الزور" },
  { code: "HAS", ar: "الحسكة" },
] as const;

/** Characters that avoid visual confusion (no 0/O/1/I). */
export const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidCodeShape(input: string): boolean {
  return /^[A-Z]{2}-[A-Z]{3}-[A-Z0-9]{3,5}(-[A-Z0-9]{2,3})?$/.test(normalizeCode(input));
}

/** Normalizes Arabic text so different spellings of the same name match. */
export function normalizeArabic(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625\u0627]/g, "ا")
    .replace(/[\u0649\u064A]/g, "ي")
    .replace(/\u0629/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");
}

const ARABIC_EQUIVALENTS: Record<string, string[]> = {
  ا: ["ا", "أ", "إ", "آ"],
  أ: ["ا", "أ", "إ", "آ"],
  إ: ["ا", "أ", "إ", "آ"],
  آ: ["ا", "أ", "إ", "آ"],
  ي: ["ي", "ى"],
  ى: ["ي", "ى"],
  ه: ["ه", "ة"],
  ة: ["ه", "ة"],
  و: ["و", "ؤ"],
};

/** Escapes LIKE wildcards so user input can't widen a pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\,]/g, " ").trim();
}

/**
 * A LIKE pattern that tolerates Arabic spelling variations (أ/إ/آ/ا, ي/ى,
 * ه/ة, ؤ/و) by matching those letters with a single-character wildcard, so a
 * user typing "المزه" still finds "المزة". Results are re-scored afterwards.
 */
export function tolerantPatterns(value: string): string[] {
  const base = escapeLike(value.trim().toLowerCase());
  if (!base) return [];
  const loose = (input: string) => input.replace(/[اأإآيىهةوؤ]/g, "_");
  const out = new Set<string>([loose(base)]);
  if (base.startsWith("ال") && base.length > 4) out.add(loose(base.slice(2)));
  out.add(base);
  return [...out];
}

export function confidenceBand(score: number): { ar: string; tone: "high" | "medium" | "low" } {
  if (score >= 80) return { ar: "درجة عالية", tone: "high" };
  if (score >= 55) return { ar: "درجة متوسطة", tone: "medium" };
  return { ar: "درجة منخفضة", tone: "low" };
}

export function formatCoords(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return "—";
  return `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`;
}

export function osmDirectionsUrl(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return "https://www.openstreetmap.org/";
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
}

// ============================================================================
// Bilingual label layer (ar | en). Arabic stays the primary voice; English is
// proper civic/logistics terminology, not literal translation.
// ============================================================================

export type LabelLang = "ar" | "en";

const pick = (lang: LabelLang, ar: string, en: string) => (lang === "ar" ? ar : en);

export const NODE_TYPE_EN: Record<string, string> = {
  property: "Property / site",
  land: "Land",
  building: "Building",
  floor: "Floor",
  apartment: "Apartment",
  office: "Office",
  shop: "Shop",
  clinic: "Clinic",
  warehouse: "Warehouse",
  farm: "Farm",
  field: "Field",
  factory: "Factory",
  school: "School",
  hospital: "Hospital",
  hotel: "Hotel",
  government_office: "Government office",
  pickup_point: "Pickup point",
  poi: "Point of interest",
  custom: "Other",
};

export const ACCESS_TYPE_EN: Record<string, string> = {
  entrance: "Entrance",
  gate: "Gate",
  delivery_point: "Delivery entrance",
  loading_dock: "Loading dock",
  service_entrance: "Service entrance",
  parking_entrance: "Parking entrance",
  emergency_entrance: "Emergency entrance",
  staff_entrance: "Staff entrance",
};

export const RESTRICTION_EN: Record<string, string> = {
  no_deliveries: "No deliveries",
  residents_only: "Residents only",
  staff_only: "Staff only",
  closed_after_hours: "Closed after hours",
  trucks_prohibited: "No trucks",
  pedestrian_only: "Pedestrians only",
  vehicle_only: "Vehicles only",
  emergency_only: "Emergency only",
  temporary_closure: "Temporarily closed",
};

export const VERIFICATION_EN: Record<string, string> = {
  unverified: "Unverified",
  user_confirmed: "Confirmed by owner",
  community_confirmed: "Community-confirmed",
  courier_verified: "Verified by a courier company",
  business_verified: "Verified business",
  organization_verified: "Verified organisation",
  official_verified: "Officially verified",
};

export const ACCESSIBILITY_EN: Record<string, string> = {
  wheelchair_accessible: "Wheelchair accessible",
  ramp: "Ramp",
  elevator: "Lift",
  stairs: "Stairs",
  accessible_parking: "Accessible parking",
};

export const GOVERNORATE_EN: Record<string, string> = {
  DAM: "Damascus",
  RDA: "Rif Dimashq",
  ALE: "Aleppo",
  HOM: "Homs",
  HAM: "Hama",
  LAT: "Latakia",
  TAR: "Tartus",
  IDL: "Idlib",
  DAR: "Daraa",
  SUW: "As-Suwayda",
  QUN: "Quneitra",
  RAQ: "Raqqa",
  DEZ: "Deir ez-Zor",
  HAS: "Al-Hasakah",
};

export const CORRECTION_TYPE_EN: Record<string, string> = {
  wrong_location: "Map location is wrong",
  wrong_business_name: "Business name is wrong",
  business_closed: "Business permanently closed",
  entrance_changed: "Entrance has changed",
  duplicate_location: "Duplicate location",
  incorrect_category: "Wrong category",
  access_issue: "Access problem",
  other: "Other",
  wrong_building_pin: "Building pin is wrong",
  wrong_entrance: "Wrong entrance",
  entrance_closed: "Entrance is closed",
  delivery_prohibited: "Deliveries not allowed at this entrance",
  wrong_floor: "Wrong floor",
  business_moved: "Business has moved",
  incorrect_name: "Incorrect name",
  incorrect_hours: "Incorrect opening hours",
  unsafe_access: "Unsafe access",
};

export const CORRECTION_FIELD_EN: Record<string, { valueLabel: string | null; placeholder: string | null }> = {
  wrong_location: { valueLabel: "Correct coordinates (latitude, longitude)", placeholder: "33.5102, 36.2913" },
  wrong_business_name: { valueLabel: "Correct name", placeholder: "Al-Nour Pharmacy" },
  business_closed: { valueLabel: null, placeholder: null },
  entrance_changed: { valueLabel: "Describe the correct entrance", placeholder: "Rear entrance on Al-Thawra Street" },
  duplicate_location: { valueLabel: "Code of the duplicate address (if known)", placeholder: "SY-DAM-XXXX" },
  incorrect_category: { valueLabel: "Correct category", placeholder: "pharmacy" },
  access_issue: { valueLabel: "What is the problem?", placeholder: "Gate is locked after 6 pm" },
  other: { valueLabel: "Your suggestion", placeholder: null },
};

export const CORRECTION_DECISION_EN: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  needs_more_info: "More information needed",
};

export function purposeLabel(value: string, lang: LabelLang = "ar") {
  const p = PURPOSES.find((item) => item.value === value);
  if (!p) return value;
  return pick(lang, p.ar, p.en);
}

export function nodeTypeLabel(value: string, lang: LabelLang = "ar") {
  return pick(lang, NODE_TYPE_LABELS[value] ?? value, NODE_TYPE_EN[value] ?? value);
}

export function accessTypeLabel(value: string, lang: LabelLang = "ar") {
  return pick(lang, ACCESS_TYPE_LABELS[value] ?? value, ACCESS_TYPE_EN[value] ?? value);
}

export function restrictionLabel(value: string, lang: LabelLang = "ar") {
  return pick(lang, RESTRICTION_LABELS[value] ?? value, RESTRICTION_EN[value] ?? value);
}

export function verificationLabel(value: string | null | undefined, lang: LabelLang = "ar") {
  const key = value ?? "unverified";
  return pick(lang, VERIFICATION_LEVELS[key]?.ar ?? "غير موثق", VERIFICATION_EN[key] ?? "Unverified");
}

export function accessibilityLabel(value: string, lang: LabelLang = "ar") {
  return pick(lang, ACCESSIBILITY_LABELS[value] ?? value, ACCESSIBILITY_EN[value] ?? value);
}

export function governorateLabel(code: string, lang: LabelLang = "ar") {
  const gov = GOVERNORATES.find((g) => g.code === code);
  if (!gov) return code;
  return pick(lang, gov.ar, GOVERNORATE_EN[code] ?? gov.ar);
}

export function correctionTypeLabel(value: string, lang: LabelLang = "ar") {
  return pick(lang, CORRECTION_TYPE_LABELS[value] ?? value, CORRECTION_TYPE_EN[value] ?? value);
}

export function correctionDecisionLabel(value: string, lang: LabelLang = "ar") {
  return pick(lang, CORRECTION_DECISION_LABELS[value] ?? value, CORRECTION_DECISION_EN[value] ?? value);
}
