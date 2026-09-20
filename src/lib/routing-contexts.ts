/**
 * Phase 18 — Routing contexts.
 * One Syriasan address can expose a different approach per trip context:
 * a visitor uses the main door, a truck enters from the industrial road,
 * an ambulance uses the east emergency gate. Client-safe module.
 */
import type { Purpose } from "./smart-address";

export type RoutingContext =
  | "standard"
  | "visitor"
  | "parcel"
  | "commercial_delivery"
  | "heavy_freight"
  | "emergency"
  | "accessible";

export type RoutingContextDef = {
  value: RoutingContext;
  ar: string;
  en: string;
  hintAr: string;
  hintEn: string;
  /** Purpose used by the access-point scoring engine. */
  purpose: Purpose;
  /** Default travel mode suggested for this context. */
  travelMode: "driving" | "walking" | "cycling" | "delivery" | "wheelchair";
  requireWheelchair: boolean;
  /** Access point types that naturally serve this context. */
  preferredAccessTypes: string[];
};

export const ROUTING_CONTEXTS: RoutingContextDef[] = [
  {
    value: "standard",
    ar: "قياسي",
    en: "Standard",
    hintAr: "أفضل مدخل متاح بشكل عام",
    hintEn: "Best generally available entrance",
    purpose: "visitor",
    travelMode: "driving",
    requireWheelchair: false,
    preferredAccessTypes: ["main_entrance", "gate", "vehicle_gate"],
  },
  {
    value: "visitor",
    ar: "زائر",
    en: "Visitor",
    hintAr: "المدخل الرئيسي واستقبال المراجعين",
    hintEn: "Main entrance and visitor reception",
    purpose: "visitor",
    travelMode: "walking",
    requireWheelchair: false,
    preferredAccessTypes: ["main_entrance", "pedestrian_gate", "reception"],
  },
  {
    value: "parcel",
    ar: "طرد بريدي",
    en: "Parcel",
    hintAr: "تسليم طرد صغير أو بريد",
    hintEn: "Small parcel or postal delivery",
    purpose: "parcel_delivery",
    travelMode: "delivery",
    requireWheelchair: false,
    preferredAccessTypes: ["delivery_entrance", "main_entrance", "side_entrance"],
  },
  {
    value: "commercial_delivery",
    ar: "توصيل تجاري",
    en: "Commercial delivery",
    hintAr: "مركبة توصيل وبضائع للمحال",
    hintEn: "Delivery vehicle and shop goods",
    purpose: "food_delivery",
    travelMode: "delivery",
    requireWheelchair: false,
    preferredAccessTypes: ["delivery_entrance", "loading_dock", "service_entrance"],
  },
  {
    value: "heavy_freight",
    ar: "شحن ثقيل",
    en: "Heavy freight",
    hintAr: "شاحنات ومقطورات ورصيف تحميل",
    hintEn: "Trucks, trailers and loading docks",
    purpose: "freight",
    travelMode: "driving",
    requireWheelchair: false,
    preferredAccessTypes: ["loading_dock", "vehicle_gate", "industrial_gate"],
  },
  {
    value: "emergency",
    ar: "طوارئ",
    en: "Emergency",
    hintAr: "إسعاف وإطفاء ودفاع مدني",
    hintEn: "Ambulance, fire and civil defence",
    purpose: "emergency",
    travelMode: "driving",
    requireWheelchair: false,
    preferredAccessTypes: ["emergency_gate", "vehicle_gate", "main_entrance"],
  },
  {
    value: "accessible",
    ar: "وصول ميسّر",
    en: "Wheelchair / accessible",
    hintAr: "منحدر وكرسي متحرك ومصعد",
    hintEn: "Ramp, wheelchair and lift access",
    purpose: "wheelchair_access",
    travelMode: "wheelchair",
    requireWheelchair: true,
    preferredAccessTypes: ["accessible_entrance", "main_entrance", "ramp"],
  },
];

export const ROUTING_CONTEXT_VALUES = ROUTING_CONTEXTS.map((c) => c.value);

export const ROUTING_CONTEXT_LABELS: Record<string, string> = Object.fromEntries(
  ROUTING_CONTEXTS.map((c) => [c.value, c.ar]),
);

/** Localized routing-context label. */
export function routingContextLabel(value: string | null | undefined, lang: "ar" | "en"): string {
  const def = routingContext(value);
  return lang === "ar" ? def.ar : def.en;
}

/** Localized routing-context hint. */
export function routingContextHint(value: string | null | undefined, lang: "ar" | "en"): string {
  const def = routingContext(value);
  return lang === "ar" ? def.hintAr : def.hintEn;
}

export function routingContext(value: string | null | undefined): RoutingContextDef {
  return ROUTING_CONTEXTS.find((c) => c.value === value) ?? ROUTING_CONTEXTS[0]!;
}

/** Map a legacy purpose value onto the closest routing context. */
export function contextForPurpose(purpose: string | null | undefined): RoutingContext {
  switch (purpose) {
    case "parcel_delivery":
      return "parcel";
    case "food_delivery":
    case "loading":
      return "commercial_delivery";
    case "freight":
      return "heavy_freight";
    case "emergency":
      return "emergency";
    case "wheelchair_access":
      return "accessible";
    case "visitor":
    case "customer":
      return "visitor";
    default:
      return "standard";
  }
}
