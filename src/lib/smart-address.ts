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

export const CORRECTION_TYPES = [
  { value: "wrong_building_pin", ar: "موقع المبنى خاطئ" },
  { value: "wrong_entrance", ar: "المدخل خاطئ" },
  { value: "entrance_closed", ar: "المدخل مغلق" },
  { value: "delivery_prohibited", ar: "التوصيل ممنوع من هذا المدخل" },
  { value: "wrong_floor", ar: "الطابق خاطئ" },
  { value: "business_moved", ar: "العمل التجاري انتقل" },
  { value: "duplicate_location", ar: "موقع مكرر" },
  { value: "incorrect_name", ar: "الاسم غير صحيح" },
  { value: "incorrect_hours", ar: "ساعات العمل غير صحيحة" },
  { value: "unsafe_access", ar: "وصول غير آمن" },
  { value: "other", ar: "أخرى" },
] as const;

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
