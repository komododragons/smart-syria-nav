/**
 * Server-only Address Quality Engine.
 * Produces an internal 0-100 quality score per location node so staff can
 * find addresses that need improvement. Never exposed to public consumers.
 */

export type QualityInputNode = {
  id: string;
  display_name: string;
  node_type: string;
  city: string | null;
  governorate: string | null;
  street: string | null;
  neighborhood: string | null;
  landmark: string | null;
  building_number: string | null;
  latitude: number | null;
  longitude: number | null;
  verification_level: string;
  last_verified_at: string | null;
  confidence_score: number;
};

export type QualityEntrance = {
  node_id: string;
  latitude: number | null;
  longitude: number | null;
  vehicle_access: boolean;
  wheelchair_accessible: boolean;
  instructions_ar: string | null;
  instructions_en: string | null;
};

export type QualityFactor = {
  key: string;
  label: string;
  weight: number;
  ok: boolean;
};

export type QualityResult = {
  node_id: string;
  display_name: string;
  node_type: string;
  city: string | null;
  governorate: string | null;
  score: number;
  grade: "excellent" | "good" | "fair" | "poor";
  factors: QualityFactor[];
  missing: string[];
  stale_days: number | null;
  has_coordinates: boolean;
  entrance_count: number;
};

const STALE_DAYS = 180;

const VERIFICATION_WEIGHTS: Record<string, number> = {
  unverified: 0,
  community_submitted: 0.35,
  user_confirmed: 0.45,
  owner_verified: 0.7,
  business_verified: 0.8,
  organization_verified: 0.9,
  syriasan_verified: 1,
  verified: 1,
};

export function daysSince(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

export function scoreAddress(
  node: QualityInputNode,
  entrances: QualityEntrance[],
  hasOpenDuplicate: boolean,
): QualityResult {
  const hasCoords = node.latitude != null && node.longitude != null;
  const entranceWithCoords = entrances.filter((e) => e.latitude != null && e.longitude != null);
  const verificationRatio = VERIFICATION_WEIGHTS[node.verification_level] ?? 0;
  const stale = daysSince(node.last_verified_at);

  const factors: QualityFactor[] = [
    { key: "coordinates", label: "إحداثيات دقيقة", weight: 20, ok: hasCoords },
    {
      key: "street",
      label: "الشارع أو الحي معروف",
      weight: 10,
      ok: Boolean(node.street || node.neighborhood),
    },
    { key: "building", label: "رقم أو اسم المبنى", weight: 10, ok: Boolean(node.building_number) },
    { key: "entrance", label: "مدخل محدد", weight: 15, ok: entrances.length > 0 },
    { key: "landmark", label: "معلم قريب", weight: 5, ok: Boolean(node.landmark) },
    { key: "verification", label: "مستوى التوثيق", weight: 15, ok: verificationRatio >= 0.7 },
    {
      key: "recent_confirmation",
      label: "تأكيد حديث",
      weight: 10,
      ok: stale != null && stale <= STALE_DAYS,
    },
    { key: "duplicate", label: "لا ازدواجية مفتوحة", weight: 5, ok: !hasOpenDuplicate },
    {
      key: "routing",
      label: "قابلية التوجيه",
      weight: 10,
      ok:
        entranceWithCoords.length > 0 &&
        entrances.some(
          (e) => e.vehicle_access || e.wheelchair_accessible || e.instructions_ar || e.instructions_en,
        ),
    },
  ];

  let score = 0;
  for (const factor of factors) {
    if (factor.key === "verification") score += factor.weight * verificationRatio;
    else if (factor.ok) score += factor.weight;
  }
  const rounded = Math.max(0, Math.min(100, Math.round(score)));

  return {
    node_id: node.id,
    display_name: node.display_name,
    node_type: node.node_type,
    city: node.city,
    governorate: node.governorate,
    score: rounded,
    grade: rounded >= 85 ? "excellent" : rounded >= 65 ? "good" : rounded >= 40 ? "fair" : "poor",
    factors,
    missing: factors.filter((f) => !f.ok).map((f) => f.label),
    stale_days: stale,
    has_coordinates: hasCoords,
    entrance_count: entrances.length,
  };
}

export const QUALITY_STALE_DAYS = STALE_DAYS;
