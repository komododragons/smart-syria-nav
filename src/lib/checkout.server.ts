/**
 * Server-only checkout resolution used by the public e-commerce endpoint.
 * Accepts a public smart code (SY-DAM-K7X4) or a temporary share token
 * (SY-TMP-XXXXX). Private residential data is only ever returned through a
 * token, and then only for the fields the owner explicitly shared.
 */
import { resolvePublicCode } from "./addresses.server";
import { normalizeCode } from "./smart-address";

export type CheckoutAddress = {
  status: "ok";
  source: "code" | "token";
  reference: string;
  /** Human-readable single line, safe to store on an order. */
  summary: string;
  fields: {
    governorate: string | null;
    city: string | null;
    district: string | null;
    neighborhood: string | null;
    street: string | null;
    building: string | null;
    entrance: string | null;
    floor: string | null;
    unit: string | null;
    landmark: string | null;
  };
  coordinates: { latitude: number; longitude: number } | null;
  delivery: {
    instructions: string | null;
    parking: string | null;
    open_now: boolean | null;
  };
  contact: { name: string | null; phone: string | null };
  verification_level: string | null;
  confidence: number | null;
  expires_at: string | null;
  navigation_url: string;
  privacy_note: string;
};

export type CheckoutResult =
  | CheckoutAddress
  | { status: "not_found"; reference: string }
  | { status: "expired"; reference: string }
  | { status: "revoked"; reference: string }
  | { status: "private"; reference: string; hint: string };

const SITE = "https://syriasan.com";

function line(parts: (string | null | undefined)[]): string {
  return parts.filter((p) => p && String(p).trim()).join(" — ");
}

function isToken(reference: string): boolean {
  return reference.startsWith("SY-TMP-");
}

export async function resolveForCheckout(rawReference: string): Promise<CheckoutResult> {
  const reference = normalizeCode(rawReference);
  return isToken(reference) ? resolveTokenForCheckout(reference) : resolveCodeForCheckout(reference);
}

async function resolveCodeForCheckout(code: string): Promise<CheckoutResult> {
  const result = await resolvePublicCode(code, "parcel_delivery");
  if (result.status === "not_found") return { status: "not_found", reference: code };
  if (result.status === "retired") return { status: "not_found", reference: code };
  if (result.status === "private") {
    return {
      status: "private",
      reference: code,
      hint: "هذا عنوان خاص — اطلب من العميل رابط مشاركة مؤقت (SY-TMP-…) بدلاً من الرمز.",
    };
  }

  const floor = result.chain.find((n) => n.node_type === "floor");
  const unit = result.chain.find((n) => n.node_type === "unit");
  const ap = result.recommended;

  return {
    status: "ok",
    source: "code",
    reference: result.code,
    summary: line([
      result.site.governorate,
      result.site.city,
      result.site.neighborhood,
      result.site.street,
      result.site.building_number ? `بناء ${result.site.building_number}` : null,
      ap?.display_name,
    ]),
    fields: {
      governorate: result.site.governorate,
      city: result.site.city,
      district: result.site.district,
      neighborhood: result.site.neighborhood,
      street: result.site.street,
      building: result.site.building_number ?? result.site.display_name,
      entrance: ap?.display_name ?? null,
      floor: floor?.floor_label ?? floor?.display_name ?? null,
      unit: unit?.unit_label ?? null,
      landmark: result.site.landmark,
    },
    coordinates:
      ap?.latitude != null && ap.longitude != null
        ? { latitude: ap.latitude, longitude: ap.longitude }
        : result.site.latitude != null && result.site.longitude != null
          ? { latitude: result.site.latitude, longitude: result.site.longitude }
          : null,
    delivery: {
      instructions: ap?.instructions ?? null,
      parking: ap?.parking_info ?? result.site.parking_info,
      open_now: ap?.open_now ?? null,
    },
    contact: { name: null, phone: result.business?.phone ?? null },
    verification_level: result.verification_level,
    confidence: result.confidence,
    expires_at: null,
    navigation_url: `${SITE}/d/${result.code}`,
    privacy_note: "عنوان عام — لا تُعرض أي بيانات سكنية خاصة.",
  };
}

async function resolveTokenForCheckout(token: string): Promise<CheckoutResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: temp } = await supabaseAdmin
    .from("temporary_addresses")
    .select(
      "id, purpose, expires_at, max_uses, use_count, revoked, smart_address_id, shared_fields, contact_phone, contact_name",
    )
    .eq("token", token)
    .maybeSingle();

  if (!temp) return { status: "not_found", reference: token };
  if (temp.revoked) return { status: "revoked", reference: token };
  if (new Date(temp.expires_at).getTime() < Date.now()) return { status: "expired", reference: token };
  if (temp.max_uses != null && temp.use_count >= temp.max_uses) {
    return { status: "expired", reference: token };
  }

  const shared = new Set<string>(temp.shared_fields ?? []);

  const { data: smart } = await supabaseAdmin
    .from("smart_addresses")
    .select("code, node_id, default_access_point_id")
    .eq("id", temp.smart_address_id)
    .maybeSingle();
  if (!smart) return { status: "not_found", reference: token };

  let currentId: string | null = smart.node_id;
  let governorate: string | null = null;
  let city: string | null = null;
  let district: string | null = null;
  let neighborhood: string | null = null;
  let street: string | null = null;
  let landmark: string | null = null;
  let building: string | null = null;
  let floor: string | null = null;
  let unit: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;
  let parking: string | null = null;

  for (let i = 0; i < 8 && currentId; i += 1) {
    const { data: node } = await supabaseAdmin
      .from("location_nodes")
      .select(
        "id, parent_id, node_type, display_name, unit_label, floor_label, building_number, latitude, longitude, governorate, city, district, neighborhood, street, landmark, parking_info",
      )
      .eq("id", currentId)
      .maybeSingle();
    if (!node) break;
    governorate ??= node.governorate;
    city ??= node.city;
    district ??= node.district;
    neighborhood ??= node.neighborhood;
    street ??= node.street;
    landmark ??= node.landmark;
    parking ??= node.parking_info;
    latitude ??= node.latitude;
    longitude ??= node.longitude;
    if (node.node_type === "building" && shared.has("building")) {
      building ??= node.building_number ?? node.display_name;
    }
    if (node.node_type === "floor" && shared.has("floor")) floor ??= node.floor_label ?? node.display_name;
    if (node.node_type === "unit" && shared.has("unit")) unit ??= node.unit_label ?? node.display_name;
    currentId = node.parent_id;
  }

  let entrance: string | null = null;
  let instructions: string | null = null;
  if (smart.default_access_point_id && shared.has("entrance")) {
    const { data: ap } = await supabaseAdmin
      .from("access_points")
      .select("display_name, latitude, longitude, instructions_ar, parking_info")
      .eq("id", smart.default_access_point_id)
      .maybeSingle();
    if (ap) {
      entrance = ap.display_name;
      instructions = shared.has("instructions") ? ap.instructions_ar : null;
      if (shared.has("location") && ap.latitude != null && ap.longitude != null) {
        latitude = ap.latitude;
        longitude = ap.longitude;
      }
      if (shared.has("parking")) parking ??= ap.parking_info;
    }
  }

  if (!shared.has("location")) {
    latitude = null;
    longitude = null;
  }
  if (!shared.has("parking")) parking = null;

  await supabaseAdmin
    .from("temporary_addresses")
    .update({ use_count: temp.use_count + 1 })
    .eq("id", temp.id);

  return {
    status: "ok",
    source: "token",
    reference: token,
    summary: line([governorate, city, neighborhood, street, building, entrance, floor, unit]),
    fields: {
      governorate,
      city,
      district,
      neighborhood,
      street,
      building,
      entrance,
      floor,
      unit,
      landmark,
    },
    coordinates: latitude != null && longitude != null ? { latitude, longitude } : null,
    delivery: { instructions, parking, open_now: null },
    contact: {
      name: shared.has("name") ? temp.contact_name : null,
      phone: shared.has("phone") ? temp.contact_phone : null,
    },
    verification_level: null,
    confidence: null,
    expires_at: temp.expires_at,
    navigation_url: `${SITE}/t/${token}`,
    privacy_note: "رابط مؤقت — تُعرض فقط الحقول التي وافق صاحب العنوان على مشاركتها.",
  };
}
