/**
 * Plan + entitlement catalogue (Phase 22).
 *
 * Deliberately contains NO pricing. Money is a later layer: when pricing is
 * introduced, only the checkout/billing side needs to be added — plans,
 * features, limits and the enforcement helpers below stay as they are.
 *
 * Consumer address creation, resolution, sharing and QR stay free forever.
 */

export type PlanId = "free" | "business" | "developer" | "enterprise";
export type PlanStatus = "active" | "trialing" | "past_due" | "canceled";

export type Entitlement =
  // free
  | "personal_addressing"
  | "address_sharing"
  | "qr_codes"
  | "temporary_links"
  | "address_vault"
  // business
  | "business_verification"
  | "multi_location"
  | "business_analytics"
  | "address_plates"
  | "team_seats"
  // developer
  | "api_access"
  | "higher_limits"
  | "embeddable_widgets"
  | "developer_tools"
  | "webhooks"
  // enterprise
  | "bulk_locations"
  | "advanced_api"
  | "team_management"
  | "sla"
  | "custom_integrations";

export type LimitKey =
  | "locations"
  | "team_members"
  | "api_keys"
  | "api_rate_per_minute"
  | "bulk_import_rows"
  | "webhooks"
  | "analytics_days";

/** -1 means unlimited / negotiated. */
export type PlanLimits = Record<LimitKey, number>;

export type PlanDefinition = {
  id: PlanId;
  name_ar: string;
  name_en: string;
  tagline_ar: string;
  audience_ar: string;
  entitlements: Entitlement[];
  limits: PlanLimits;
};

const FREE_ENTITLEMENTS: Entitlement[] = [
  "personal_addressing",
  "address_sharing",
  "qr_codes",
  "temporary_links",
  "address_vault",
];

const BUSINESS_ENTITLEMENTS: Entitlement[] = [
  ...FREE_ENTITLEMENTS,
  "business_verification",
  "multi_location",
  "business_analytics",
  "address_plates",
  "team_seats",
];

const DEVELOPER_ENTITLEMENTS: Entitlement[] = [
  ...BUSINESS_ENTITLEMENTS,
  "api_access",
  "higher_limits",
  "embeddable_widgets",
  "developer_tools",
  "webhooks",
];

const ENTERPRISE_ENTITLEMENTS: Entitlement[] = [
  ...DEVELOPER_ENTITLEMENTS,
  "bulk_locations",
  "advanced_api",
  "team_management",
  "sla",
  "custom_integrations",
];

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name_ar: "مجاني",
    name_en: "Free",
    tagline_ar: "العنونة الشخصية مجانية دائماً",
    audience_ar: "للأفراد والعائلات",
    entitlements: FREE_ENTITLEMENTS,
    limits: {
      locations: 5,
      team_members: 1,
      api_keys: 0,
      api_rate_per_minute: 0,
      bulk_import_rows: 0,
      webhooks: 0,
      analytics_days: 0,
    },
  },
  business: {
    id: "business",
    name_ar: "الأعمال",
    name_en: "Business",
    tagline_ar: "نشاط موثّق بعدة فروع وتحليلات",
    audience_ar: "للمتاجر والعيادات والشركات",
    entitlements: BUSINESS_ENTITLEMENTS,
    limits: {
      locations: 25,
      team_members: 10,
      api_keys: 0,
      api_rate_per_minute: 0,
      bulk_import_rows: 0,
      webhooks: 0,
      analytics_days: 90,
    },
  },
  developer: {
    id: "developer",
    name_ar: "المطوّرون",
    name_en: "Developer",
    tagline_ar: "واجهة برمجية وويدجت وحدود أعلى",
    audience_ar: "للمتاجر الإلكترونية وشركات التوصيل",
    entitlements: DEVELOPER_ENTITLEMENTS,
    limits: {
      locations: 100,
      team_members: 25,
      api_keys: 10,
      api_rate_per_minute: 300,
      bulk_import_rows: 2000,
      webhooks: 10,
      analytics_days: 180,
    },
  },
  enterprise: {
    id: "enterprise",
    name_ar: "المؤسسات",
    name_en: "Enterprise",
    tagline_ar: "مواقع بالجملة، واجهة متقدمة، واتفاقية مستوى خدمة",
    audience_ar: "للمؤسسات والجهات الحكومية والمشغّلين الوطنيين",
    entitlements: ENTERPRISE_ENTITLEMENTS,
    limits: {
      locations: -1,
      team_members: -1,
      api_keys: -1,
      api_rate_per_minute: 1200,
      bulk_import_rows: -1,
      webhooks: -1,
      analytics_days: -1,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "business", "developer", "enterprise"];

export const ENTITLEMENT_LABELS_AR: Record<Entitlement, string> = {
  personal_addressing: "عنونة شخصية وإنشاء عناوين ذكية",
  address_sharing: "مشاركة العنوان وروابط مؤقتة آمنة",
  qr_codes: "رموز QR للعنوان",
  temporary_links: "روابط مشاركة تنتهي صلاحيتها",
  address_vault: "خزنة عناوين خاصة",
  business_verification: "توثيق النشاط التجاري",
  multi_location: "فروع ومواقع متعددة",
  business_analytics: "تحليلات الاستخدام للأعمال",
  address_plates: "لوحات عناوين قابلة للطباعة",
  team_seats: "مقاعد فريق",
  api_access: "الوصول إلى الواجهة البرمجية",
  higher_limits: "حدود استخدام أعلى",
  embeddable_widgets: "ويدجت العنوان القابل للتضمين",
  developer_tools: "أدوات المطوّرين والبيئة التجريبية",
  webhooks: "ويبهوكس للأحداث",
  bulk_locations: "استيراد مواقع بالجملة",
  advanced_api: "واجهة برمجية متقدمة",
  team_management: "إدارة فريق وأدوار متقدمة",
  sla: "اتفاقية مستوى خدمة",
  custom_integrations: "تكاملات مخصصة",
};

export const LIMIT_LABELS_AR: Record<LimitKey, string> = {
  locations: "المواقع",
  team_members: "أعضاء الفريق",
  api_keys: "مفاتيح الواجهة البرمجية",
  api_rate_per_minute: "طلبات في الدقيقة",
  bulk_import_rows: "صفوف الاستيراد بالجملة",
  webhooks: "ويبهوكس",
  analytics_days: "أيام التحليلات",
};

export function planDefinition(plan: PlanId | null | undefined): PlanDefinition {
  return PLANS[(plan ?? "free") as PlanId] ?? PLANS.free;
}

/** A plan only grants entitlements while its subscription is usable. */
export function isPlanUsable(status: PlanStatus | null | undefined, expiresAt: string | null): boolean {
  if (status && status !== "active" && status !== "trialing") return false;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return false;
  return true;
}

export function effectivePlan(
  plan: PlanId | null | undefined,
  status: PlanStatus | null | undefined,
  expiresAt: string | null = null,
): PlanId {
  return isPlanUsable(status, expiresAt) ? ((plan ?? "free") as PlanId) : "free";
}

export function hasEntitlement(plan: PlanId | null | undefined, entitlement: Entitlement): boolean {
  return planDefinition(plan).entitlements.includes(entitlement);
}

export function limitFor(plan: PlanId | null | undefined, key: LimitKey): number {
  return planDefinition(plan).limits[key];
}

export function withinLimit(plan: PlanId | null | undefined, key: LimitKey, used: number): boolean {
  const limit = limitFor(plan, key);
  return limit < 0 || used < limit;
}

export function formatLimit(value: number): string {
  return value < 0 ? "غير محدود" : value.toLocaleString("en-US");
}
