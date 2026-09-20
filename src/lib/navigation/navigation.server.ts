/**
 * Server-only navigation domain services.
 *
 * AddressResolutionService  — smart code → property, entrances, access points
 * EntranceSelectionService  — the documented destination hierarchy
 * LocationPrivacyService    — decides which last-metre fields a viewer may see
 * RouteSharingService       — public + private (tokenised) share links
 * RoadReportService         — community reports into the moderation queue
 * Analytics + rate limiting — privacy-conscious, no coordinates or PII
 */
import { randomBytes } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { serverPublicClient } from "../addresses.server";
import { haversineMeters } from "./geo";
import type {
  Coordinates,
  DestinationKind,
  LastMetreCard,
  NavDestination,
  NavEntranceOption,
  NavRoadAccessPoint,
  NavWarning,
  TravelMode,
} from "./types";

type AnyClient = SupabaseClient<Database>;

/** Distance past which we stop routing to the entrance and use the road point. */
const ROAD_HANDOVER_M = 25;
/** Confidence below which the address itself is flagged to the user. */
const LOW_CONFIDENCE = 55;
const STALE_DAYS = 540;

export type ResolvedAddress = {
  smart_code: string;
  smart_address_id: string;
  node_id: string;
  property_name: string;
  node_type: string;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  landmark: string | null;
  floor_label: string | null;
  unit_label: string | null;
  property_point: Coordinates | null;
  confidence_score: number;
  verification_level: string;
  updated_at: string;
  is_public: boolean;
  owner_id: string | null;
  default_access_point_id: string | null;
  entrances: NavEntranceOption[];
  road_access_points: NavRoadAccessPoint[];
};

// ---------------- AddressResolutionService ----------------

export async function resolveForNavigation(
  code: string,
  client?: AnyClient,
): Promise<ResolvedAddress | null> {
  const supa = (client ?? serverPublicClient()) as AnyClient;
  const normalized = code.trim().toUpperCase();

  const { data: smart } = await supa
    .from("smart_addresses")
    .select(
      "id, code, node_id, is_public, status, default_access_point_id, created_by, location_nodes(id, display_name, node_type, city, neighborhood, street, landmark, floor_label, unit_label, latitude, longitude, confidence_score, verification_level, updated_at, visibility, created_by, is_active)",
    )
    .eq("code", normalized)
    .maybeSingle();

  if (!smart) return null;
  const node = Array.isArray(smart.location_nodes) ? smart.location_nodes[0] : smart.location_nodes;
  if (!node || !node.is_active) return null;

  const [{ data: aps }, { data: raps }] = await Promise.all([
    supa
      .from("access_points")
      .select(
        "id, display_name, access_type, latitude, longitude, is_primary, is_delivery_entrance, is_parking_entrance, is_emergency_entrance, is_loading_entrance, wheelchair_accessible, vehicle_access, temporarily_closed, temporary_status, status_reason, photo_url, instructions_ar, instructions_en, confidence_score, verification_level, sort_order, is_active, access_point_contexts(context, allowed, approach_ar, approach_en, preferred_road, vehicle_note, note)",
      )
      .eq("node_id", node.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supa
      .from("road_access_points")
      .select(
        "id, latitude, longitude, access_type, stopping_allowed, parking_available, road_name, approach_direction, notes_ar, notes_en, vehicle_types, verification_status, access_point_id",
      )
      .eq("node_id", node.id),
  ]);

  return {
    smart_code: smart.code,
    smart_address_id: smart.id,
    node_id: node.id,
    property_name: node.display_name,
    node_type: node.node_type,
    city: node.city,
    neighborhood: node.neighborhood,
    street: node.street,
    landmark: node.landmark,
    floor_label: node.floor_label,
    unit_label: node.unit_label,
    property_point:
      node.latitude != null && node.longitude != null
        ? { latitude: node.latitude, longitude: node.longitude }
        : null,
    confidence_score: node.confidence_score,
    verification_level: node.verification_level,
    updated_at: node.updated_at,
    is_public: smart.is_public && node.visibility === "public",
    owner_id: node.created_by ?? smart.created_by ?? null,
    default_access_point_id: smart.default_access_point_id,
    entrances: (aps ?? []).map((a) => ({
      id: a.id,
      display_name: a.display_name,
      access_type: a.access_type,
      latitude: a.latitude,
      longitude: a.longitude,
      is_primary: a.is_primary,
      contexts: ((a as { access_point_contexts?: unknown }).access_point_contexts ?? []) as NavEntranceOption["contexts"],
      is_delivery_entrance: a.is_delivery_entrance,
      is_parking_entrance: a.is_parking_entrance,
      is_emergency_entrance: a.is_emergency_entrance,
      is_loading_entrance: a.is_loading_entrance,
      wheelchair_accessible: a.wheelchair_accessible,
      vehicle_access: a.vehicle_access,
      temporarily_closed: a.temporarily_closed,
      temporary_status: a.temporary_status,
      status_reason: a.status_reason,
      photo_url: a.photo_url,
      instructions_ar: a.instructions_ar,
      instructions_en: a.instructions_en,
      confidence_score: a.confidence_score,
      verification_level: a.verification_level,
    })),
    road_access_points: (raps ?? []).map((r) => ({
      id: r.id,
      latitude: r.latitude,
      longitude: r.longitude,
      access_type: r.access_type,
      stopping_allowed: r.stopping_allowed,
      parking_available: r.parking_available,
      road_name: r.road_name,
      approach_direction: r.approach_direction,
      notes_ar: r.notes_ar,
      notes_en: r.notes_en,
      vehicle_types: r.vehicle_types,
      verification_status: r.verification_status,
    })),
  };
}

// ---------------- EntranceSelectionService ----------------

function usable(e: NavEntranceOption): boolean {
  return e.latitude != null && e.longitude != null && !e.temporarily_closed;
}

function modePreferred(e: NavEntranceOption, mode: TravelMode): boolean {
  if (mode === "walking") return e.access_type === "pedestrian" || !e.vehicle_access;
  if (mode === "delivery") return e.is_delivery_entrance;
  if (mode === "heavy") return e.is_loading_entrance || e.vehicle_access;
  if (mode === "cycling") return !e.vehicle_access || e.access_type === "pedestrian";
  return e.vehicle_access || e.is_primary;
}

export type DestinationSelection = {
  point: Coordinates;
  kind: DestinationKind;
  entrance: NavEntranceOption | null;
  road_access: NavRoadAccessPoint | null;
  warnings: NavWarning[];
};

/**
 * The documented destination hierarchy:
 * user-selected entrance → mode-preferred entrance → delivery entrance →
 * road access point → parking/stopping point → main entrance → property.
 *
 * Never returns the building centroid unless nothing better exists.
 */
export function selectDestination(
  address: ResolvedAddress,
  opts: {
    mode: TravelMode;
    entranceId?: string | null;
    wheelchair?: boolean;
    purpose?: string;
    context?: string;
  },
): DestinationSelection {
  const warnings: NavWarning[] = [];
  const entrances = address.entrances;
  const wheelchairOk = (e: NavEntranceOption) => !opts.wheelchair || e.wheelchair_accessible;
  const ctxName = opts.context ?? null;
  const ctxEntry = (e: NavEntranceOption) => e.contexts?.find((c) => c.context === ctxName) ?? null;
  const ctxAllows = (e: NavEntranceOption) => (ctxEntry(e)?.allowed ?? true) !== false;

  const pick = (e: NavEntranceOption | undefined, kind: DestinationKind): DestinationSelection | null =>
    e && usable(e) && wheelchairOk(e)
      ? {
          point: { latitude: e.latitude as number, longitude: e.longitude as number },
          kind,
          entrance: e,
          road_access: null,
          warnings: [],
        }
      : null;

  let chosen: DestinationSelection | null = null;

  // Phase 18 — an entrance the owner mapped to this routing context wins.
  if (ctxName) {
    const contextual = entrances
      .filter((e) => ctxAllows(e) && ctxEntry(e))
      .sort((a, b) => Number(Boolean(ctxEntry(b)?.approach_ar)) - Number(Boolean(ctxEntry(a)?.approach_ar)));
    chosen = pick(contextual[0], "mode_preferred_entrance");
  }

  if (opts.entranceId) {
    const requested = entrances.find((e) => e.id === opts.entranceId);
    if (requested && requested.temporarily_closed) warnings.push("entrance_temporarily_closed");
    chosen = pick(requested, "user_selected_entrance");
  }

  chosen ??= pick(
    entrances.find((e) => ctxAllows(e) && modePreferred(e, opts.mode)),
    "mode_preferred_entrance",
  );

  if (!chosen && (opts.mode === "delivery" || opts.purpose?.includes("delivery"))) {
    chosen = pick(entrances.find((e) => ctxAllows(e) && e.is_delivery_entrance), "delivery_entrance");
  }

  chosen ??= pick(entrances.find((e) => ctxAllows(e) && e.is_primary), "main_entrance");
  chosen ??= pick(entrances.find((e) => ctxAllows(e) && usable(e)), "main_entrance");

  // Road access point / parking point, used both as a destination of last
  // resort and as the vehicle handover point below.
  const roadPoint =
    address.road_access_points.find((r) => r.access_type === "road_access" && r.stopping_allowed) ??
    address.road_access_points[0] ??
    null;
  const parkingPoint = address.road_access_points.find((r) => r.parking_available) ?? null;

  if (!chosen && roadPoint) {
    chosen = {
      point: { latitude: roadPoint.latitude, longitude: roadPoint.longitude },
      kind: "road_access_point",
      entrance: null,
      road_access: roadPoint,
      warnings: [],
    };
  }
  if (!chosen && parkingPoint) {
    chosen = {
      point: { latitude: parkingPoint.latitude, longitude: parkingPoint.longitude },
      kind: "parking_point",
      entrance: null,
      road_access: parkingPoint,
      warnings: [],
    };
  }
  if (!chosen && address.property_point) {
    chosen = {
      point: address.property_point,
      kind: "property_centroid",
      entrance: null,
      road_access: null,
      warnings: ["approximate_route"],
    };
  }
  if (!chosen) {
    return {
      point: { latitude: 0, longitude: 0 },
      kind: "property_centroid",
      entrance: null,
      road_access: null,
      warnings: ["approximate_route"],
    };
  }

  // Vehicle journeys stop at the road access point when the entrance itself is
  // meaningfully away from it; the last leg becomes a dashed walking segment.
  const vehicular = opts.mode !== "walking" && opts.mode !== "cycling";
  if (vehicular && chosen.entrance && roadPoint) {
    const gap = haversineMeters(chosen.point, {
      latitude: roadPoint.latitude,
      longitude: roadPoint.longitude,
    });
    if (gap > ROAD_HANDOVER_M) {
      warnings.push("entrance_not_on_road_network");
      chosen = { ...chosen, road_access: roadPoint };
    }
  }

  chosen.warnings = [...new Set([...chosen.warnings, ...warnings])];
  return chosen;
}

export function buildDestination(
  address: ResolvedAddress,
  selection: DestinationSelection,
  mode: TravelMode,
  context = "standard",
): NavDestination {
  const warnings = new Set<NavWarning>(selection.warnings);
  if (address.confidence_score < LOW_CONFIDENCE) warnings.add("low_confidence_address");
  if (Date.now() - new Date(address.updated_at).getTime() > STALE_DAYS * 86_400_000) {
    warnings.add("stale_address_data");
  }
  if (address.verification_level === "unverified") warnings.add("unverified_road_data");

  const usesRoadHandover = warnings.has("entrance_not_on_road_network") && selection.road_access;
  const routedPoint = usesRoadHandover
    ? { latitude: selection.road_access!.latitude, longitude: selection.road_access!.longitude }
    : selection.point;

  const finalLeg = usesRoadHandover ? haversineMeters(routedPoint, selection.point) : null;

  const label =
    selection.entrance?.display_name ??
    selection.road_access?.road_name ??
    address.property_name;

  return {
    smart_code: address.smart_code,
    property_name: address.property_name,
    city: address.city,
    neighborhood: address.neighborhood,
    point: routedPoint,
    kind: usesRoadHandover ? "road_access_point" : selection.kind,
    point_label_ar: label,
    point_label_en: selection.road_access?.road_name ?? null,
    entrance_id: selection.entrance?.id ?? null,
    node_id: address.node_id,
    property_point: address.property_point,
    final_leg_on_foot: Boolean(usesRoadHandover),
    final_leg_meters: finalLeg,
    warnings: [...warnings],
    context,
    context_approach: (() => {
      const c = selection.entrance?.contexts?.find((x) => x.context === context);
      return c?.approach_ar ?? c?.approach_en ?? null;
    })(),
    context_preferred_road:
      selection.entrance?.contexts?.find((x) => x.context === context)?.preferred_road ?? null,
    context_vehicle_note:
      selection.entrance?.contexts?.find((x) => x.context === context)?.vehicle_note ?? null,
  };
}

// ---------------- LocationPrivacyService ----------------

export type ViewerContext = {
  userId: string | null;
  isOwner: boolean;
  isStaff: boolean;
  privateLinkGranted: boolean;
};

export async function viewerContext(
  address: ResolvedAddress,
  userId: string | null,
  supa: AnyClient,
  privateLinkGranted = false,
): Promise<ViewerContext> {
  let isStaff = false;
  if (userId) {
    const { data } = await supa
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["moderator", "admin"]);
    isStaff = Boolean(data?.length);
  }
  return {
    userId,
    isOwner: Boolean(userId && address.owner_id === userId),
    isStaff,
    privateLinkGranted,
  };
}

/**
 * Builds the arrival card. Unit numbers, intercom names and delivery notes are
 * stripped unless the viewer owns the address, is staff, or arrived through a
 * valid private delivery link.
 */
export async function lastMetreCard(
  address: ResolvedAddress,
  entranceId: string | null,
  viewer: ViewerContext,
  supa: AnyClient,
  lang: "ar" | "en" = "ar",
): Promise<LastMetreCard> {
  const authorised = viewer.isOwner || viewer.isStaff || viewer.privateLinkGranted;

  const { data: rows } = await supa
    .from("last_metre_instructions")
    .select("*")
    .eq("node_id", address.node_id)
    .order("created_at", { ascending: false });

  const candidates = (rows ?? []).filter(
    (r) => !entranceId || !r.access_point_id || r.access_point_id === entranceId,
  );
  const preferred =
    candidates.find((r) => r.language === lang) ?? candidates[0] ?? null;

  const entrance = address.entrances.find((e) => e.id === entranceId) ?? null;
  const visiblePrivate = authorised || preferred?.visibility === "public";

  return {
    building_name: address.property_name,
    entrance_name: entrance?.display_name ?? null,
    entrance_photo: entrance?.photo_url ?? null,
    landmark: preferred?.landmark_description ?? address.landmark,
    door_description: preferred?.door_description ?? null,
    floor: visiblePrivate ? (preferred?.floor ?? address.floor_label) : null,
    unit_number: visiblePrivate ? (preferred?.unit_number ?? address.unit_label) : null,
    intercom_name: visiblePrivate ? (preferred?.intercom_name ?? null) : null,
    elevator_available: preferred?.elevator_available ?? null,
    stairs_required: preferred?.stairs_required ?? null,
    accessibility_notes: preferred?.accessibility_notes ?? null,
    call_on_arrival: preferred?.call_on_arrival ?? false,
    instruction_text:
      preferred?.instruction_text ??
      (lang === "en" ? entrance?.instructions_en : entrance?.instructions_ar) ??
      null,
    delivery_notes: authorised ? (preferred?.delivery_notes ?? null) : null,
    private_fields_visible: authorised,
  };
}

// ---------------- RouteSharingService ----------------

export function generateShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export type ShareRedemption =
  | { ok: true; share: Database["public"]["Tables"]["route_shares"]["Row"] }
  | { ok: false; reason: "not_found" | "revoked" | "expired" | "used" };

/**
 * Redeems a share token with the admin client (the row is not readable by the
 * recipient under RLS) and records an access event.
 */
export async function redeemShare(token: string, admin: AnyClient): Promise<ShareRedemption> {
  const { data: share } = await admin
    .from("route_shares")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!share) return { ok: false, reason: "not_found" };

  const log = async (outcome: string) => {
    await admin.from("route_share_access").insert({ share_id: share.id, outcome });
  };

  if (share.revoked) {
    await log("revoked");
    return { ok: false, reason: "revoked" };
  }
  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    await log("expired");
    return { ok: false, reason: "expired" };
  }
  if (share.one_time && share.access_count >= 1) {
    await log("used");
    return { ok: false, reason: "used" };
  }

  await admin
    .from("route_shares")
    .update({ access_count: share.access_count + 1 })
    .eq("id", share.id);
  await log("granted");
  return { ok: true, share };
}

// ---------------- Analytics + rate limiting ----------------

export type NavEventName =
  | "directions_requested"
  | "route_generated"
  | "route_generation_failed"
  | "navigation_started"
  | "navigation_completed"
  | "navigation_abandoned"
  | "origin_method_selected"
  | "travel_mode_selected"
  | "entrance_changed"
  | "private_route_shared"
  | "smart_address_searched"
  | "business_directions_requested"
  | "multi_stop_route_created"
  | "route_problem_reported"
  | "location_permission_granted"
  | "location_permission_denied";

/**
 * Records an abstract product event. Deliberately accepts no coordinates,
 * apartment numbers, phone numbers or free text from the user.
 */
export async function trackNavEvent(
  admin: AnyClient,
  event: NavEventName,
  fields: {
    smart_code?: string | null;
    travel_mode?: string | null;
    origin_method?: string | null;
    destination_kind?: string | null;
    provider?: string | null;
    success?: boolean | null;
    duration_ms?: number | null;
    city?: string | null;
  } = {},
): Promise<void> {
  const { error } = await admin.from("navigation_events").insert({
    event,
    smart_code: fields.smart_code ?? null,
    travel_mode: fields.travel_mode ?? null,
    origin_method: fields.origin_method ?? null,
    destination_kind: fields.destination_kind ?? null,
    provider: fields.provider ?? null,
    success: fields.success ?? null,
    duration_ms: fields.duration_ms ?? null,
    city: fields.city ?? null,
  });
  if (error) console.error("[nav-analytics] insert failed", error.message);
}

/**
 * Coarse database-backed rate limit. Server workers are stateless, so the
 * counter lives in navigation_events rather than process memory.
 */
export async function rateLimit(
  admin: AnyClient,
  event: NavEventName,
  maxPerMinute: number,
): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("navigation_events")
    .select("id", { count: "exact", head: true })
    .eq("event", event)
    .gte("created_at", since);
  return (count ?? 0) < maxPerMinute;
}

export async function recordProviderHealth(
  admin: AnyClient,
  provider: string,
  health: { healthy: boolean; latency_ms: number; status_code: number | null; message: string | null },
): Promise<void> {
  await admin.from("navigation_provider_health").insert({
    provider,
    healthy: health.healthy,
    latency_ms: health.latency_ms,
    status_code: health.status_code,
    message: health.message,
  });
}
