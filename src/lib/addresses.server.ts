/**
 * Server-only resolution engine for the Smart Address Network.
 * Never imported directly by components — only by *.functions.ts handlers.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { normalizeCode, type Purpose } from "./smart-address";

export type PublicClient = SupabaseClient<Database>;

/** Publishable-key client for public reads (RLS applies as anon). */
export function serverPublicClient(): PublicClient {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type NodeRow = Database["public"]["Tables"]["location_nodes"]["Row"];
export type AccessPointRow = Database["public"]["Tables"]["access_points"]["Row"] & {
  access_point_purposes: { purpose: string; allowed: boolean; note: string | null }[];
  access_restrictions: { restriction: string; note_ar: string | null }[];
};

export type ResolvedAccessPoint = {
  id: string;
  display_name: string;
  name_en: string | null;
  access_type: string;
  latitude: number | null;
  longitude: number | null;
  instructions: string | null;
  accessibility: string[];
  hours: { always_open: boolean; opens_at: string | null; closes_at: string | null };
  open_now: boolean;
  verification_level: string;
  confidence_score: number;
  restrictions: { restriction: string; note_ar: string | null }[];
  purpose_allowed: boolean | null;
  score: number;
  parking_info: string | null;
  loading_info: string | null;
  last_verified_at: string | null;
  wheelchair_accessible: boolean;
  vehicle_access: boolean;
  photo_url: string | null;
};

export type ResolveResult =
  | { status: "not_found"; code: string }
  | { status: "private"; code: string }
  | { status: "retired"; code: string; redirect_to?: string }
  | {
      status: "ok";
      code: string;
      redirected_from?: string | undefined;
      purpose: Purpose;
      label: string | null;
      site: { id: string; display_name: string; node_type: string; latitude: number | null; longitude: number | null; governorate: string | null; city: string | null; district: string | null; neighborhood: string | null; street: string | null; landmark: string | null; public_notes: string | null; building_number: string | null; parking_info: string | null; loading_info: string | null; wheelchair_accessible: boolean | null; has_elevator: boolean | null; verification_method: string | null; last_verified_at: string | null };
      chain: { id: string; node_type: string; display_name: string; name_en: string | null; unit_label: string | null; floor_label: string | null; description: string | null }[];
      recommended: ResolvedAccessPoint | null;
      alternatives: ResolvedAccessPoint[];
      prohibited: { display_name: string; reason: string }[];
      restrictions: string[];
      verification_level: string;
      confidence: number;
      notes: string[];
    };

const ACCESS_TYPE_AFFINITY: Record<string, Purpose[]> = {
  delivery_point: ["parcel_delivery", "food_delivery"],
  loading_dock: ["freight", "loading"],
  gate: ["freight", "loading", "visitor"],
  emergency_entrance: ["emergency"],
  service_entrance: ["service", "maintenance", "utility"],
  parking_entrance: ["parking"],
  staff_entrance: ["employee"],
  entrance: ["visitor", "resident", "customer"],
};

/** Damascus local time (UTC+3), used for opening-hours awareness. */
function damascusMinutes(now = new Date()): number {
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utc + 180) % 1440;
}

function toMinutes(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  if (h == null || m == null) return null;
  return Number(h) * 60 + Number(m);
}

export function isOpenNow(ap: { always_open: boolean; opens_at: string | null; closes_at: string | null; temporarily_closed: boolean }): boolean {
  if (ap.temporarily_closed) return false;
  if (ap.always_open) return true;
  const open = toMinutes(ap.opens_at);
  const close = toMinutes(ap.closes_at);
  if (open == null || close == null) return true;
  const now = damascusMinutes();
  return close > open ? now >= open && now < close : now >= open || now < close;
}

async function ancestorChain(supa: PublicClient, nodeId: string): Promise<NodeRow[]> {
  const chain: NodeRow[] = [];
  let current: string | null = nodeId;
  for (let i = 0; i < 8 && current; i += 1) {
    const result = await supa.from("location_nodes").select("*").eq("id", current).maybeSingle();
    const data: NodeRow | null = result.data as NodeRow | null;
    if (!data) break;
    chain.unshift(data as NodeRow);
    current = data.parent_id;
  }
  return chain;
}

async function subtreeIds(supa: PublicClient, rootId: string): Promise<string[]> {
  const ids = [rootId];
  let frontier = [rootId];
  for (let depth = 0; depth < 4 && frontier.length; depth += 1) {
    const { data } = await supa.from("location_nodes").select("id").in("parent_id", frontier);
    frontier = (data ?? []).map((r) => r.id);
    ids.push(...frontier);
  }
  return ids;
}

function scoreAccessPoint(ap: AccessPointRow, purpose: Purpose): { score: number; allowed: boolean | null; reason: string | null } {
  const record = ap.access_point_purposes.find((p) => p.purpose === purpose);
  if (record && !record.allowed) {
    return { score: -1, allowed: false, reason: record.note ?? "هذا الغرض ممنوع من هذا المدخل" };
  }
  const restrictionBlocks =
    (purpose === "parcel_delivery" || purpose === "food_delivery") &&
    ap.access_restrictions.some((r) => r.restriction === "no_deliveries");
  if (restrictionBlocks) {
    return { score: -1, allowed: false, reason: "ممنوع التوصيل من هذا المدخل" };
  }
  if (purpose === "freight" && ap.access_restrictions.some((r) => r.restriction === "trucks_prohibited")) {
    return { score: -1, allowed: false, reason: "ممنوع دخول الشاحنات" };
  }
  if (ap.access_restrictions.some((r) => r.restriction === "emergency_only") && purpose !== "emergency") {
    return { score: -1, allowed: false, reason: "مخصص للطوارئ فقط" };
  }

  let score = record?.allowed ? 100 : 25;
  if ((ACCESS_TYPE_AFFINITY[ap.access_type] ?? []).includes(purpose)) score += 30;
  score += Math.round(ap.confidence_score * 0.2);
  if (ap.temporarily_closed) score -= 60;
  else if (isOpenNow(ap)) score += 15;
  else score -= 25;
  return { score, allowed: record?.allowed ?? null, reason: null };
}

function shapeAccessPoint(ap: AccessPointRow, score: number, allowed: boolean | null): ResolvedAccessPoint {
  return {
    id: ap.id,
    display_name: ap.display_name,
    name_en: ap.name_en,
    access_type: ap.access_type,
    latitude: ap.latitude,
    longitude: ap.longitude,
    instructions: ap.instructions_ar ?? ap.instructions_en,
    accessibility: ap.accessibility ?? [],
    hours: { always_open: ap.always_open, opens_at: ap.opens_at, closes_at: ap.closes_at },
    open_now: isOpenNow(ap),
    verification_level: ap.verification_level,
    confidence_score: ap.confidence_score,
    restrictions: ap.access_restrictions,
    purpose_allowed: allowed,
    score,
  };
}

export async function resolvePublicCode(
  rawCode: string,
  purpose: Purpose,
  options: { requireWheelchair?: boolean } = {},
): Promise<ResolveResult> {
  const supa = serverPublicClient();
  const code = normalizeCode(rawCode);

  let redirectedFrom: string | undefined;
  let record = (
    await supa.from("smart_addresses").select("*").ilike("code", code).eq("is_public", true).maybeSingle()
  ).data;

  if (!record) {
    const { data: redirect } = await supa
      .from("smart_address_redirects")
      .select("new_code")
      .ilike("old_code", code)
      .maybeSingle();
    if (redirect) {
      redirectedFrom = code;
      record = (
        await supa
          .from("smart_addresses")
          .select("*")
          .ilike("code", redirect.new_code)
          .eq("is_public", true)
          .maybeSingle()
      ).data;
    }
  }

  if (!record) return { status: "not_found", code };
  if (record.status === "retired" || record.status === "merged") {
    return { status: "retired", code };
  }

  const chain = await ancestorChain(supa, record.node_id);
  if (!chain.length) return { status: "private", code };
  const site = chain[0]!;
  const ids = await subtreeIds(supa, site.id);

  const { data: apsRaw } = await supa
    .from("access_points")
    .select("*, access_point_purposes(purpose, allowed, note), access_restrictions(restriction, note_ar)")
    .in("node_id", ids)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const aps = (apsRaw ?? []) as unknown as AccessPointRow[];
  const allowedList: ResolvedAccessPoint[] = [];
  const prohibited: { display_name: string; reason: string }[] = [];

  for (const ap of aps) {
    const { score, allowed, reason } = scoreAccessPoint(ap, purpose);
    if (score < 0) {
      prohibited.push({ display_name: ap.display_name, reason: reason ?? "غير مسموح" });
      continue;
    }
    let adjusted = score;
    if (options.requireWheelchair) {
      adjusted += (ap.accessibility ?? []).includes("wheelchair_accessible") ? 40 : -30;
    }
    if (record.default_access_point_id === ap.id) adjusted += 5;
    allowedList.push(shapeAccessPoint(ap, adjusted, allowed));
  }

  allowedList.sort((a, b) => b.score - a.score);
  const recommended = allowedList[0] ?? null;

  const notes: string[] = [];
  if (redirectedFrom) notes.push(`تم تحويل الرمز القديم ${redirectedFrom} إلى ${record.code}`);
  for (const p of prohibited) notes.push(`لا تستخدم ${p.display_name}: ${p.reason}`);
  if (recommended && !recommended.open_now) {
    notes.push("جميع نقاط الوصول المسموحة مغلقة حالياً — تحقق من ساعات العمل قبل التوجه.");
  }

  const target = chain[chain.length - 1]!;

  return {
    status: "ok",
    code: record.code,
    redirected_from: redirectedFrom,
    purpose,
    label: record.label,
    site: {
      id: site.id,
      display_name: site.display_name,
      node_type: site.node_type,
      latitude: site.latitude,
      longitude: site.longitude,
      governorate: site.governorate,
      city: site.city,
      district: site.district,
      neighborhood: site.neighborhood,
      street: site.street,
      landmark: site.landmark,
      public_notes: site.public_notes,
    },
    chain: chain.map((n) => ({
      id: n.id,
      node_type: n.node_type,
      display_name: n.display_name,
      name_en: n.name_en,
      unit_label: n.unit_label,
      floor_label: n.floor_label,
      description: n.description,
    })),
    recommended,
    alternatives: allowedList.slice(1, 4),
    prohibited,
    restrictions: recommended
      ? recommended.restrictions.map((r) => r.note_ar ?? r.restriction)
      : [],
    verification_level: target.verification_level,
    confidence: target.confidence_score,
    notes,
  };
}

/** Generates a collision-checked, non-sequential public smart code. */
export async function generateSmartCode(
  supa: SupabaseClient<Database>,
  governorateCode: string,
): Promise<string> {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pick = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `SY-${governorateCode}-${pick(4)}-${pick(2)}`;
    const { data } = await supa.from("smart_addresses").select("id").ilike("code", candidate).maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("تعذر توليد رمز فريد، أعد المحاولة");
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
