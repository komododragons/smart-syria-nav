import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ADDRESS_CLASSIFICATIONS,
  COMMERCIAL_CLASSIFICATIONS,
  commercialContentSignals,
  isCommercialClassification,
  isPublicClassification,
} from "./address-classification";

const purposeSchema = z.string().min(2).max(40);
const addressClassificationSchema = z.enum(ADDRESS_CLASSIFICATIONS);

export const resolveAddress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(4).max(32),
        purpose: purposeSchema.optional(),
        context: z.string().max(40).optional(),
        wheelchair: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolvePublicCode } = await import("./addresses.server");
    const { routingContext, contextForPurpose } = await import("./routing-contexts");
    // A caller may pass either a routing context (phase 18) or a legacy purpose.
    const ctx = routingContext(data.context ?? contextForPurpose(data.purpose));
    return resolvePublicCode(data.code, (data.purpose ?? ctx.purpose) as never, {
      requireWheelchair: data.wheelchair ?? false,
      context: ctx.value,
    });
  });

const BIZ_FIELDS =
  "id, name_ar, name_en, category, place_category, phone, website, opening_hours, verification_level, node_id, visitor_access_point_id, delivery_access_point_id, smart_addresses(code), location_nodes(display_name, governorate, city, district, neighborhood, street, landmark, latitude, longitude, unit_label, floor_label)";
const NODE_FIELDS =
  "id, display_name, name_en, node_type, place_category, governorate, city, district, neighborhood, street, landmark, verification_level, confidence_score, latitude, longitude";

const VERIFIED_RANK: Record<string, number> = {
  syriasan_verified: 40,
  organization_verified: 32,
  business_verified: 26,
  owner_claimed: 18,
  community_submitted: 8,
  unverified: 0,
};

export const searchNetwork = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().max(120),
        category: z.string().max(40).optional(),
        governorate: z.string().max(80).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { serverPublicClient, haversineMeters } = await import("./addresses.server");
    const { normalizeArabic, normalizeCode, tolerantPatterns, escapeLike } = await import("./smart-address");
    const { RESIDENTIAL_NODE_TYPES } = await import("./place-categories");
    const supa = serverPublicClient();
    const raw = data.query.trim();
    if (raw.length < 2) return { businesses: [], places: [], code: null, codes: [] };

    const normalized = normalizeArabic(raw);
    const variants = tolerantPatterns(raw);
    if (!variants.length) variants.push(escapeLike(raw).toLowerCase());
    const patterns = variants.map((v) => `%${v}%`);
    const hasOrigin = data.latitude != null && data.longitude != null;

    const orFor = (fields: string[]) =>
      fields.flatMap((f) => patterns.map((p) => `${f}.ilike.${p}`)).join(",");

    let bizQuery = supa
      .from("businesses")
      .select(BIZ_FIELDS)
      .eq("is_published", true)
      .eq("is_archived", false)
      .or(orFor(["name_ar", "name_en", "category", "place_category"]))
      .limit(40);
    if (data.category) bizQuery = bizQuery.eq("place_category", data.category);

    let nodeQuery = supa
      .from("location_nodes")
      .select(NODE_FIELDS)
      .eq("visibility", "public")
      .eq("is_active", true)
      .or(
        orFor([
          "display_name",
          "name_en",
          "district",
          "neighborhood",
          "street",
          "landmark",
          "city",
          "governorate",
          "place_category",
        ]),
      )
      .limit(60);
    if (data.category) nodeQuery = nodeQuery.eq("place_category", data.category);
    if (data.governorate) nodeQuery = nodeQuery.eq("governorate", data.governorate);

    const codeNeedle = normalizeCode(raw);
    const [businessRes, placeRes, aliasRes, codeRes] = await Promise.all([
      bizQuery,
      nodeQuery,
      supa
        .from("location_aliases")
        .select("node_id, alias")
        .or(patterns.map((p) => `alias.ilike.${p}`).join(","))
        .limit(30),
      supa
        .from("smart_addresses")
        .select("code, label, node_id")
        .eq("is_public", true)
        .eq("status", "active")
        .ilike("code", `%${escapeLike(codeNeedle)}%`)
        .limit(5),
    ]);

    const aliasNodeIds = (aliasRes.data ?? []).map((a) => a.node_id);
    let aliasPlaces: NonNullable<typeof placeRes.data> = [];
    if (aliasNodeIds.length) {
      let aliasQuery = supa
        .from("location_nodes")
        .select(NODE_FIELDS)
        .in("id", aliasNodeIds)
        .eq("visibility", "public")
        .eq("is_active", true);
      if (data.category) aliasQuery = aliasQuery.eq("place_category", data.category);
      if (data.governorate) aliasQuery = aliasQuery.eq("governorate", data.governorate);
      const { data: extra } = await aliasQuery;
      aliasPlaces = extra ?? [];
    }

    const placeMap = new Map<string, (typeof aliasPlaces)[number]>();
    for (const p of [...(placeRes.data ?? []), ...aliasPlaces]) {
      // Second privacy layer: a home never appears in public search, whatever its flags say.
      if (RESIDENTIAL_NODE_TYPES.includes(p.node_type)) continue;
      placeMap.set(p.id, p);
    }

    // Public smart codes for the matching sites, so every result can be navigated to.
    const placeIds = [...placeMap.keys()];
    const codeByNode = new Map<string, string>();
    if (placeIds.length) {
      const { data: codes } = await supa
        .from("smart_addresses")
        .select("code, node_id")
        .eq("is_public", true)
        .eq("status", "active")
        .in("node_id", placeIds);
      for (const c of codes ?? []) if (c.node_id && !codeByNode.has(c.node_id)) codeByNode.set(c.node_id, c.code);
    }

    /** Text relevance: exact > prefix > word start > contains. */
    const textScore = (values: (string | null | undefined)[]) => {
      let best = 0;
      for (const value of values) {
        if (!value) continue;
        const hay = normalizeArabic(value);
        if (!hay) continue;
        if (hay === normalized) best = Math.max(best, 100);
        else if (hay.startsWith(normalized)) best = Math.max(best, 70);
        else if (hay.includes(` ${normalized}`)) best = Math.max(best, 55);
        else if (hay.includes(normalized)) best = Math.max(best, 35);
      }
      return best;
    };

    const distanceOf = (lat?: number | null, lng?: number | null) => {
      if (!hasOrigin || lat == null || lng == null) return null;
      return Math.round(
        haversineMeters({ lat: data.latitude!, lng: data.longitude! }, { lat, lng }),
      );
    };

    /** Nearer is better, with a gentle decay: 0 m → +45, 5 km → ~+9, 25 km → ~+2. */
    const proximityScore = (meters: number | null) =>
      meters == null ? 0 : Math.round(45 / (1 + meters / 1200));

    const businesses = (businessRes.data ?? [])
      .map((biz) => {
        const node = Array.isArray(biz.location_nodes) ? biz.location_nodes[0] : biz.location_nodes;
        const distance_m = distanceOf(node?.latitude, node?.longitude);
        const smart = Array.isArray(biz.smart_addresses) ? biz.smart_addresses[0] : biz.smart_addresses;
        const score =
          textScore([biz.name_ar, biz.name_en, biz.category, node?.neighborhood, node?.district]) +
          (VERIFIED_RANK[biz.verification_level] ?? 0) +
          proximityScore(distance_m) +
          // public usefulness: reachable code, category, contact details
          (smart?.code ? 14 : 0) +
          (biz.place_category ? 8 : 0) +
          (biz.phone || biz.opening_hours ? 4 : 0);
        return { ...biz, distance_m, score };
      })
      .sort((a, b) => b.score - a.score || (a.distance_m ?? 1e9) - (b.distance_m ?? 1e9))
      .slice(0, 20);

    const places = [...placeMap.values()]
      .map((place) => {
        const distance_m = distanceOf(place.latitude, place.longitude);
        const code = codeByNode.get(place.id) ?? null;
        const score =
          textScore([
            place.display_name,
            place.name_en,
            place.neighborhood,
            place.district,
            place.street,
            place.landmark,
            place.city,
          ]) +
          (VERIFIED_RANK[place.verification_level] ?? 0) +
          proximityScore(distance_m) +
          Math.round(place.confidence_score / 8) +
          (code ? 14 : 0) +
          (place.place_category ? 8 : 0);
        return { ...place, code, distance_m, score };
      })
      .sort((a, b) => b.score - a.score || (a.distance_m ?? 1e9) - (b.distance_m ?? 1e9))
      .slice(0, 25);

    // Aggregate "appeared in search" signal for public results only. No searcher
    // identity, no query text and no residential address is ever stored.
    const shownCodes = [
      ...new Set(
        [
          ...businesses.map(
            (b) =>
              (Array.isArray(b.smart_addresses) ? b.smart_addresses[0] : b.smart_addresses)?.code ??
              null,
          ),
          ...places.map((p) => p.code),
        ].filter((c): c is string => Boolean(c)),
      ),
    ].slice(0, 20);
    if (shownCodes.length) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("address_events")
          .insert(
            shownCodes.map((code) => ({
              smart_code: code,
              event_type: "search_appearance",
              source: "search",
            })),
          );
      } catch {
        // analytics must never break a search
      }
    }

    return {
      businesses,
      places,
      code: codeRes.data?.[0] ?? null,
      codes: codeRes.data ?? [],
    };
  });

export const nearbySites = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        radius: z.number().min(20).max(5000).default(150),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { serverPublicClient, haversineMeters } = await import("./addresses.server");
    const supa = serverPublicClient();
    const delta = 0.02;
    const { data: nodes } = await supa
      .from("location_nodes")
      .select("id, display_name, node_type, latitude, longitude, neighborhood, city, verification_level, confidence_score")
      .eq("visibility", "public")
      .eq("is_active", true)
      .in("node_type", ["building", "property", "farm", "warehouse", "factory", "hospital", "school", "hotel"])
      .gte("latitude", data.latitude - delta)
      .lte("latitude", data.latitude + delta)
      .gte("longitude", data.longitude - delta)
      .lte("longitude", data.longitude + delta)
      .limit(60);

    return (nodes ?? [])
      .filter((n) => n.latitude != null && n.longitude != null)
      .map((n) => ({
        ...n,
        distance_meters: Math.round(
          haversineMeters(
            { lat: data.latitude, lng: data.longitude },
            { lat: n.latitude as number, lng: n.longitude as number },
          ),
        ),
      }))
      .filter((n) => n.distance_meters <= data.radius)
      .sort((a, b) => a.distance_meters - b.distance_meters)
      .slice(0, 8);
  });

const wizardSchema = z.object({
  intent: z.enum(["home", "business", "office", "shop", "building", "warehouse", "farm", "other"]),
  site: z.object({
    existing_node_id: z.string().uuid().nullable().default(null),
    node_type: z.string().min(2).max(40),
    display_name: z.string().min(2).max(120),
    name_en: z.string().max(120).optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    governorate_code: z.string().length(3),
    governorate: z.string().max(60),
    city: z.string().max(60).optional(),
    district: z.string().max(60).optional(),
    neighborhood: z.string().max(60).optional(),
    street: z.string().max(120).optional(),
    landmark: z.string().max(160).optional(),
  }),
  access_point: z
    .object({
      existing_id: z.string().uuid().nullable().default(null),
      access_type: z.string().min(2).max(40),
      display_name: z.string().min(1).max(120),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      instructions: z.string().max(500).optional(),
      accessibility: z.array(z.string().max(40)).max(8).default([]),
      always_open: z.boolean().default(false),
      opens_at: z.string().max(8).nullable().default(null),
      closes_at: z.string().max(8).nullable().default(null),
      allowed_purposes: z.array(z.string().max(40)).max(24).default([]),
      prohibited_purposes: z.array(z.string().max(40)).max(24).default([]),
      restrictions: z.array(z.string().max(40)).max(12).default([]),
    })
    .nullable()
    .default(null),
  floor: z.object({ label: z.string().max(20), order: z.number().int().min(-10).max(200) }).nullable().default(null),
  unit: z
    .object({ node_type: z.string().max(40), label: z.string().max(40), description: z.string().max(200).optional() })
    .nullable()
    .default(null),
  label: z.string().max(80).optional(),
  address_classification: addressClassificationSchema,
  business: z
    .object({
      name_ar: z.string().min(2).max(120),
      name_en: z.string().max(120).optional(),
      category: z.string().max(80).optional(),
      place_category: z.string().max(40).optional(),
      phone: z.string().max(40).optional(),
      website: z.string().max(160).optional(),
      opening_hours: z.string().max(160).optional(),
    })
    .nullable()
    .default(null),
});

export const createSmartAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => wizardSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { generateSmartCode } = await import("./addresses.server");
    const supa = context.supabase;
    const userId = context.userId;
    const isPublic = isPublicClassification(data.address_classification);
    const isCommercial = isCommercialClassification(data.address_classification);
    if (data.business && !isCommercial) throw new Error("business_data_requires_commercial_classification");
    if (isCommercial && !data.business) throw new Error("commercial_classification_requires_business_name");

    // 1. Site / building node — reuse when the user picked an existing one.
    let siteId = data.site.existing_node_id;
    if (!siteId) {
      const { data: site, error } = await supa
        .from("location_nodes")
        .insert({
          node_type: data.site.node_type,
          display_name: data.site.display_name,
          name_ar: data.site.display_name,
          name_en: data.site.name_en ?? null,
          latitude: data.site.latitude,
          longitude: data.site.longitude,
          governorate: data.site.governorate,
          city: data.site.city ?? null,
          district: data.site.district ?? null,
          neighborhood: data.site.neighborhood ?? null,
          street: data.site.street ?? null,
          landmark: data.site.landmark ?? null,
          visibility: isPublic ? "public" : "private",
          verification_level: "user_confirmed",
          confidence_score: 60,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      siteId = site.id;
    }

    // 2. Access point (entrance / gate / dock) with purposes and restrictions.
    let accessPointId: string | null = data.access_point?.existing_id ?? null;
    if (data.access_point && !accessPointId) {
      const ap = data.access_point;
      const { data: created, error } = await supa
        .from("access_points")
        .insert({
          node_id: siteId,
          access_type: ap.access_type,
          display_name: ap.display_name,
          name_ar: ap.display_name,
          latitude: ap.latitude,
          longitude: ap.longitude,
          instructions_ar: ap.instructions ?? null,
          accessibility: ap.accessibility,
          always_open: ap.always_open,
          opens_at: ap.always_open ? null : ap.opens_at,
          closes_at: ap.always_open ? null : ap.closes_at,
          verification_level: "user_confirmed",
          confidence_score: 60,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      accessPointId = created.id;

      const purposeRows = [
        ...ap.allowed_purposes.map((purpose) => ({ access_point_id: created.id, purpose, allowed: true })),
        ...ap.prohibited_purposes.map((purpose) => ({ access_point_id: created.id, purpose, allowed: false })),
      ];
      if (purposeRows.length) await supa.from("access_point_purposes").insert(purposeRows);
      if (ap.restrictions.length) {
        await supa
          .from("access_restrictions")
          .insert(ap.restrictions.map((restriction) => ({ access_point_id: created.id, restriction })));
      }
    }

    // 3. Optional floor, then optional unit — hierarchy only deepens when needed.
    let targetNodeId = siteId;
    if (data.floor) {
      const { data: floor, error } = await supa
        .from("location_nodes")
        .insert({
          parent_id: siteId,
          node_type: "floor",
          display_name: `الطابق ${data.floor.label}`,
          floor_label: data.floor.label,
          floor_order: data.floor.order,
          latitude: data.site.latitude,
          longitude: data.site.longitude,
          governorate: data.site.governorate,
          city: data.site.city ?? null,
          visibility: isPublic ? "public" : "private",
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      targetNodeId = floor.id;
    }

    if (data.unit) {
      const { data: unit, error } = await supa
        .from("location_nodes")
        .insert({
          parent_id: targetNodeId,
          node_type: data.unit.node_type || "apartment",
          display_name: data.unit.label,
          unit_label: data.unit.label,
          description: data.unit.description ?? null,
          latitude: data.site.latitude,
          longitude: data.site.longitude,
          governorate: data.site.governorate,
          city: data.site.city ?? null,
          visibility: isPublic ? "public" : "private",
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      targetNodeId = unit.id;
    }

    // 4. Public smart code — non-sequential, collision checked.
    const code = await generateSmartCode(supa, data.site.governorate_code);
    const { data: smart, error: codeError } = await supa
      .from("smart_addresses")
      .insert({
        code,
        node_id: targetNodeId,
        default_access_point_id: accessPointId,
        label: data.label ?? data.site.display_name,
        is_public: isPublic,
        address_classification: data.address_classification,
        classification_status: "confirmed",
        created_by: userId,
      })
      .select("id, code")
      .single();
    if (codeError) throw new Error(codeError.message);

    if (data.business) {
      const { error: businessError } = await supa.from("businesses").insert({
        name_ar: data.business.name_ar,
        name_en: data.business.name_en ?? null,
        category: data.business.category ?? null,
        place_category: data.business.place_category ?? null,
        phone: data.business.phone ?? null,
        website: data.business.website ?? null,
        opening_hours: data.business.opening_hours ?? null,
        node_id: targetNodeId,
        smart_address_id: smart.id,
        visitor_access_point_id: accessPointId,
        delivery_access_point_id: accessPointId,
        owner_id: userId,
        is_published: true,
      });
      if (businessError) throw new Error(businessError.message);
    }

    if (data.address_classification === "private_residence") {
      const reasons = commercialContentSignals({ name: data.site.display_name });
      if (reasons.length) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("commercial_address_reviews").upsert({
          smart_address_id: smart.id,
          owner_id: userId,
          reasons,
          score: Math.min(100, reasons.length * 25),
          evidence: { source: "address_creation", signal_count: reasons.length },
          status: "open",
        }, { onConflict: "smart_address_id", ignoreDuplicates: true });
      }
    }

    await supa.from("audit_logs").insert({
      actor_id: userId,
      action: "address_created",
      resource_type: "smart_address",
      resource_id: smart.id,
      metadata: { code: smart.code, intent: data.intent, address_classification: data.address_classification, is_public: isPublic },
    });

    return { code: smart.code, smart_address_id: smart.id, node_id: targetNodeId };
  });

export const listMyAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("smart_addresses")
      .select(
        "id, code, label, is_public, status, address_classification, classification_status, created_at, location_nodes(id, display_name, node_type, unit_label, floor_label, neighborhood, city, governorate, street, landmark, public_notes, visibility, latitude, longitude, confidence_score, verification_level, building_number, parking_info, loading_info, wheelchair_accessible, has_elevator), access_points(id, display_name, instructions_ar, access_type, latitude, longitude, parking_info, loading_info), commercial_address_reviews(id, reasons, score, status, owner_response, created_at)",
      )
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Owner-only permanent deletion of a smart address and its location (cascades). */
export const deleteMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ smart_address_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: addr } = await context.supabase
      .from("smart_addresses")
      .select("id, code, node_id, created_by")
      .eq("id", data.smart_address_id)
      .eq("created_by", context.userId)
      .maybeSingle();
    if (!addr) throw new Error("not_found_or_forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: node } = await supabaseAdmin
      .from("location_nodes")
      .select("id, created_by")
      .eq("id", addr.node_id)
      .maybeSingle();
    if (node && node.created_by === context.userId) {
      const { error } = await supabaseAdmin.from("location_nodes").delete().eq("id", node.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("smart_addresses").delete().eq("id", addr.id);
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "address_deleted",
      resource_type: "smart_address",
      resource_id: addr.id,
      metadata: { code: addr.code },
    });
    return { ok: true as const };
  });

/** Owner-only edit of a smart address: label/privacy, site details, and default entrance. */
export const updateMyAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        smart_address_id: z.string().uuid(),
        node_id: z.string().uuid(),
        access_point_id: z.string().uuid().nullable().optional(),
        label: z.string().max(120).nullable().optional(),
        address_classification: addressClassificationSchema,
        display_name: z.string().min(2).max(160),
        neighborhood: z.string().max(120).nullable().optional(),
        street: z.string().max(160).nullable().optional(),
        landmark: z.string().max(160).nullable().optional(),
        public_notes: z.string().max(500).nullable().optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        entrance_name: z.string().max(160).nullable().optional(),
        entrance_instructions: z.string().max(500).nullable().optional(),
        building_number: z.string().max(40).nullable().optional(),
        parking_info: z.string().max(300).nullable().optional(),
        loading_info: z.string().max(300).nullable().optional(),
        wheelchair_accessible: z.boolean().nullable().optional(),
        has_elevator: z.boolean().nullable().optional(),
        entrance_parking_info: z.string().max(300).nullable().optional(),
        entrance_loading_info: z.string().max(300).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const isPublic = isPublicClassification(data.address_classification);
    const commercialClassification = isCommercialClassification(data.address_classification);
    if (commercialClassification) {
      const { data: business } = await context.supabase.from("businesses").select("id").eq("smart_address_id", data.smart_address_id).maybeSingle();
      if (!business) throw new Error("convert_to_business_required");
    }
    // Ownership enforced by RLS: updates only land when created_by = auth.uid().
    const { data: addr, error: addrErr } = await context.supabase
      .from("smart_addresses")
      .update({
        label: data.label ?? null,
        is_public: isPublic,
        address_classification: data.address_classification,
        classification_status: "confirmed",
      })
      .eq("id", data.smart_address_id)
      .select("id")
      .maybeSingle();
    if (addrErr) throw new Error(addrErr.message);
    if (!addr) throw new Error("not_found_or_forbidden");

    const { error: nodeErr } = await context.supabase
      .from("location_nodes")
      .update({
        display_name: data.display_name,
        neighborhood: data.neighborhood ?? null,
        street: data.street ?? null,
        landmark: data.landmark ?? null,
        public_notes: data.public_notes ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        building_number: data.building_number ?? null,
        parking_info: data.parking_info ?? null,
        loading_info: data.loading_info ?? null,
        wheelchair_accessible: data.wheelchair_accessible ?? null,
        has_elevator: data.has_elevator ?? null,
        visibility: isPublic ? "public" : "private",
      })
      .eq("id", data.node_id);
    if (nodeErr) throw new Error(nodeErr.message);

    if (data.access_point_id) {
      const { error: apErr } = await context.supabase
        .from("access_points")
        .update({
          ...(data.entrance_name ? { display_name: data.entrance_name } : {}),
          instructions_ar: data.entrance_instructions ?? null,
          parking_info: data.entrance_parking_info ?? null,
          loading_info: data.entrance_loading_info ?? null,
        })
        .eq("id", data.access_point_id);
      if (apErr) throw new Error(apErr.message);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.address_classification === "private_residence") {
      const reasons = commercialContentSignals({ name: data.display_name });
      if (reasons.length) {
        await supabaseAdmin.from("commercial_address_reviews").upsert({
          smart_address_id: data.smart_address_id,
          owner_id: context.userId,
          reasons,
          score: Math.min(100, reasons.length * 25),
          evidence: { source: "owner_edit", signal_count: reasons.length },
          status: "open",
        }, { onConflict: "smart_address_id", ignoreDuplicates: true });
      }
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "address_updated",
      resource_type: "smart_address",
      resource_id: data.smart_address_id,
       metadata: { node_id: data.node_id, address_classification: data.address_classification, is_public: isPublic },
    });

    return { ok: true as const };
  });

export const convertMyAddressToBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      smart_address_id: z.string().uuid(),
      classification: addressClassificationSchema.refine(isCommercialClassification),
      name_ar: z.string().min(2).max(120),
      category: z.string().max(80).optional(),
      phone: z.string().max(40).optional(),
      website: z.string().url().max(160).optional(),
      opening_hours: z.string().max(160).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: address, error } = await context.supabase
      .from("smart_addresses")
      .select("id, node_id, default_access_point_id")
      .eq("id", data.smart_address_id)
      .eq("created_by", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!address) throw new Error("not_found_or_forbidden");

    const { data: existing } = await context.supabase
      .from("businesses")
      .select("id")
      .eq("smart_address_id", address.id)
      .maybeSingle();
    if (!existing) {
      const { error: businessError } = await context.supabase.from("businesses").insert({
        name_ar: data.name_ar,
        category: data.category ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        opening_hours: data.opening_hours ?? null,
        node_id: address.node_id,
        smart_address_id: address.id,
        visitor_access_point_id: address.default_access_point_id,
        delivery_access_point_id: address.default_access_point_id,
        owner_id: context.userId,
        is_published: true,
      });
      if (businessError) throw new Error(businessError.message);
    }

    const { error: updateError } = await context.supabase.from("smart_addresses").update({
      address_classification: data.classification,
      classification_status: "confirmed",
      is_public: true,
    }).eq("id", address.id);
    if (updateError) throw new Error(updateError.message);
    await context.supabase.from("location_nodes").update({ visibility: "public" }).eq("id", address.node_id);
    await context.supabase.from("commercial_address_reviews").update({ status: "converted", owner_response: "converted_to_business" }).eq("smart_address_id", address.id).in("status", ["open", "owner_confirmed_private", "conversion_requested"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "address_converted_to_business", resource_type: "smart_address", resource_id: address.id, metadata: { classification: data.classification } });
    return { ok: true as const };
  });

export const respondToCommercialReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ review_id: z.string().uuid(), response: z.enum(["owner_confirmed_private", "conversion_requested"]), note: z.string().max(1000).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("commercial_address_reviews").update({ status: data.response, owner_response: data.note ?? data.response }).eq("id", data.review_id).eq("owner_id", context.userId).select("smart_address_id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("not_found_or_forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({ actor_id: context.userId, action: "commercial_review_owner_response", resource_type: "smart_address", resource_id: row.smart_address_id, metadata: { response: data.response } });
    return { ok: true as const };
  });

export const SHARE_FIELDS = [
  "location",
  "building",
  "entrance",
  "floor",
  "unit",
  "instructions",
  "parking",
  "phone",
  "name",
] as const;
export type ShareField = (typeof SHARE_FIELDS)[number];

const shareFieldSchema = z.enum(SHARE_FIELDS);

export const createTemporaryAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        smart_address_id: z.string().uuid(),
        purpose: purposeSchema.default("parcel_delivery"),
        hours: z.number().int().min(1).max(8760).default(24),
        one_use: z.boolean().default(false),
        label: z.string().max(80).optional(),
        shared_fields: z.array(shareFieldSchema).min(1).max(9).optional(),
        contact_phone: z.string().max(32).optional(),
        contact_name: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { readPrivacy, filterSharedFields, clampShareHours } = await import("./privacy.functions");
    const prefs = await readPrivacy(context.supabase, context.userId);

    // Share tokens gate private address details: use a CSPRNG and enough
    // entropy (16 chars over a 32-symbol alphabet = 80 bits) to prevent guessing.
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const token = `SY-TMP-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
    const hours = clampShareHours(data.hours, prefs);
    const expires = new Date(Date.now() + hours * 3600_000).toISOString();
    // Owner privacy switches win over whatever the caller requested.
    const requested = data.shared_fields ?? ["location", "building", "entrance", "instructions"];
    const fields = filterSharedFields(requested, prefs);
    if (fields.length === 0) fields.push("location");

    const { data: row, error } = await context.supabase
      .from("temporary_addresses")
      .insert({
        token,
        smart_address_id: data.smart_address_id,
        purpose: data.purpose,
        expires_at: expires,
        max_uses: data.one_use ? 1 : null,
        created_by: context.userId,
        label: data.label?.trim() || null,
        shared_fields: fields,
        contact_phone: fields.includes("phone") ? data.contact_phone?.trim() || null : null,
        contact_name: fields.includes("name") ? data.contact_name?.trim() || null : null,
      })
      .select("token, expires_at, purpose, max_uses, shared_fields")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "temporary_address_created",
      resource_type: "temporary_address",
      resource_id: token,
      metadata: { purpose: data.purpose, hours: data.hours, shared_fields: fields },
    });

    return row;
  });

export const listTemporaryLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ smart_address_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("temporary_addresses")
      .select(
        "id, token, purpose, expires_at, max_uses, use_count, revoked, label, shared_fields, created_at",
      )
      .eq("smart_address_id", data.smart_address_id)
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const revokeTemporaryLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("temporary_addresses")
      .update({ revoked: true })
      .eq("id", data.id)
      .eq("created_by", context.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "temporary_address_revoked",
      resource_type: "temporary_address",
      resource_id: data.id,
      metadata: {},
    });
    return { ok: true as const };
  });

export const resolveTemporaryToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token: z.string().min(6).max(32) }).parse(input),
  )
  .handler(async ({ data }) => {
    const token = data.token.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: temp } = await supabaseAdmin
      .from("temporary_addresses")
      .select(
        "id, purpose, expires_at, max_uses, use_count, revoked, smart_address_id, shared_fields, contact_phone, contact_name, label",
      )
      .eq("token", token)
      .maybeSingle();

    if (!temp) return { status: "not_found" as const };
    if (temp.revoked) return { status: "revoked" as const };
    if (new Date(temp.expires_at).getTime() < Date.now()) return { status: "expired" as const };
    if (temp.max_uses != null && temp.use_count >= temp.max_uses) return { status: "expired" as const };

    const shared = new Set<string>(temp.shared_fields ?? []);

    const { data: smart } = await supabaseAdmin
      .from("smart_addresses")
      .select("code, node_id, default_access_point_id")
      .eq("id", temp.smart_address_id)
      .maybeSingle();
    if (!smart) return { status: "not_found" as const };

    // Purpose-limited disclosure: only the fields the owner explicitly shared.
    const rawChain: {
      node_type: string;
      display_name: string;
      unit_label: string | null;
      floor_label: string | null;
    }[] = [];
    let currentId: string | null = smart.node_id;
    let site: {
      display_name: string;
      latitude: number | null;
      longitude: number | null;
      neighborhood: string | null;
      city: string | null;
      parking_info: string | null;
    } | null = null;
    for (let i = 0; i < 8 && currentId; i += 1) {
      const nodeResult = await supabaseAdmin
        .from("location_nodes")
        .select(
          "id, parent_id, node_type, display_name, unit_label, floor_label, latitude, longitude, neighborhood, city, parking_info",
        )
        .eq("id", currentId)
        .maybeSingle();
      const node = nodeResult.data as {
        id: string;
        parent_id: string | null;
        node_type: string;
        display_name: string;
        unit_label: string | null;
        floor_label: string | null;
        latitude: number | null;
        longitude: number | null;
        neighborhood: string | null;
        city: string | null;
        parking_info: string | null;
      } | null;
      if (!node) break;
      rawChain.unshift({
        node_type: node.node_type,
        display_name: node.display_name,
        unit_label: node.unit_label,
        floor_label: node.floor_label,
      });
      site = {
        display_name: node.display_name,
        latitude: node.latitude,
        longitude: node.longitude,
        neighborhood: node.neighborhood,
        city: node.city,
        parking_info: node.parking_info,
      };
      currentId = node.parent_id;
    }

    const chain = rawChain
      .filter((n) => {
        if (n.node_type === "unit") return shared.has("unit");
        if (n.node_type === "floor") return shared.has("floor");
        if (n.node_type === "building") return shared.has("building");
        if (n.node_type === "entrance") return shared.has("entrance");
        return true;
      })
      .map((n) => ({
        node_type: n.node_type,
        label: n.unit_label ?? n.floor_label ?? n.display_name,
      }));

    let accessPoint: {
      display_name: string;
      latitude: number | null;
      longitude: number | null;
      instructions_ar: string | null;
      opens_at: string | null;
      closes_at: string | null;
      parking_info: string | null;
    } | null = null;
    if (smart.default_access_point_id && shared.has("entrance")) {
      const { data: ap } = await supabaseAdmin
        .from("access_points")
        .select(
          "display_name, latitude, longitude, instructions_ar, opens_at, closes_at, parking_info",
        )
        .eq("id", smart.default_access_point_id)
        .maybeSingle();
      accessPoint = ap ?? null;
    }
    if (accessPoint && !shared.has("instructions")) accessPoint.instructions_ar = null;
    if (accessPoint && !shared.has("parking")) accessPoint.parking_info = null;
    if (accessPoint && !shared.has("location")) {
      accessPoint.latitude = null;
      accessPoint.longitude = null;
    }

    if (site && !shared.has("location")) {
      site = { ...site, latitude: null, longitude: null };
    }
    if (site && !shared.has("parking")) site = { ...site, parking_info: null };

    await supabaseAdmin
      .from("temporary_addresses")
      .update({ use_count: temp.use_count + 1 })
      .eq("id", temp.id);

    return {
      status: "ok" as const,
      token,
      purpose: temp.purpose,
      expires_at: temp.expires_at,
      label: temp.label,
      shared_fields: temp.shared_fields ?? [],
      site,
      chain,
      access_point: accessPoint,
      contact_phone: shared.has("phone") ? temp.contact_phone : null,
      contact_name: shared.has("name") ? temp.contact_name : null,
    };
  });

/**
 * Community correction. Stores the original value alongside the suggestion so
 * moderators can compare; it never overwrites live data.
 */
export const reportCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        smart_code: z.string().max(32).optional(),
        issue_type: z.string().min(2).max(60),
        details: z.string().max(600).optional(),
        node_id: z.string().uuid().nullable().optional(),
        access_point_id: z.string().uuid().nullable().optional(),
        business_id: z.string().uuid().nullable().optional(),
        target_field: z
          .enum([
            "node_coordinates",
            "business_name",
            "business_status",
            "business_category",
            "place_category",
            "entrance",
            "access",
            "other",
          ])
          .optional(),
        suggested_value: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;

    // Snapshot the current value so the review shows original vs suggested.
    let original: string | null = null;
    const field = data.target_field ?? "other";
    if (data.node_id && (field === "node_coordinates" || field === "place_category")) {
      const { data: node } = await supa
        .from("location_nodes")
        .select("latitude, longitude, place_category")
        .eq("id", data.node_id)
        .maybeSingle();
      if (node) {
        original =
          field === "node_coordinates"
            ? node.latitude != null && node.longitude != null
              ? `${node.latitude}, ${node.longitude}`
              : null
            : node.place_category;
      }
    } else if (data.business_id) {
      const { data: biz } = await supa
        .from("businesses")
        .select("name_ar, category, is_published")
        .eq("id", data.business_id)
        .maybeSingle();
      if (biz) {
        original =
          field === "business_name"
            ? biz.name_ar
            : field === "business_category"
              ? biz.category
              : field === "business_status"
                ? biz.is_published
                  ? "مفتوح ومنشور"
                  : "غير منشور"
                : null;
      }
    } else if (data.access_point_id && (field === "entrance" || field === "access")) {
      const { data: ap } = await supa
        .from("access_points")
        .select("display_name, instructions_ar")
        .eq("id", data.access_point_id)
        .maybeSingle();
      if (ap) original = [ap.display_name, ap.instructions_ar].filter(Boolean).join(" — ");
    }

    const { error } = await supa.from("correction_reports").insert({
      smart_code: data.smart_code ?? null,
      issue_type: data.issue_type,
      details: data.details ?? null,
      node_id: data.node_id ?? null,
      access_point_id: data.access_point_id ?? null,
      business_id: data.business_id ?? null,
      target_field: field,
      suggested_value: data.suggested_value?.trim() || null,
      original_value: original,
      status: "pending",
      reporter_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitVisitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        smart_code: z.string().min(4).max(32),
        purpose: purposeSchema,
        access_point_id: z.string().uuid().nullable().default(null),
        successful: z.boolean(),
        notes: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("visit_feedback").insert({
      smart_code: data.smart_code,
      purpose: data.purpose,
      access_point_id: data.access_point_id,
      successful: data.successful,
      notes: data.notes ?? null,
      reporter_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Moderation decision on a community correction. The suggested change is only
 * written to live data when the reviewer approves AND asks to apply it.
 */
export const reviewCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected", "needs_more_info"]),
        note: z.string().max(400).optional(),
        apply: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { data: isAdmin } = await supa.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isModerator } = await supa.rpc("has_role", {
      _user_id: context.userId,
      _role: "moderator",
    });
    if (!isAdmin && !isModerator) throw new Error("غير مصرح بمراجعة التصحيحات");

    const { data: report, error: readError } = await supa
      .from("correction_reports")
      .select("id, node_id, access_point_id, business_id, target_field, suggested_value, status")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!report) throw new Error("التقرير غير موجود");

    let applied = false;
    let appliedNote: string | null = null;

    if (data.decision === "approved" && data.apply) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const value = report.suggested_value?.trim() ?? "";
      const field = report.target_field ?? "other";

      if (field === "node_coordinates" && report.node_id) {
        const [latRaw, lngRaw] = value.split(/[,،]/);
        const lat = Number(latRaw);
        const lng = Number(lngRaw);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          await supabaseAdmin
            .from("location_nodes")
            .update({ latitude: lat, longitude: lng, verification_level: "user_confirmed" })
            .eq("id", report.node_id);
          applied = true;
        } else {
          appliedNote = "الإحداثيات المقترحة غير صالحة — لم يُطبّق التغيير";
        }
      } else if (field === "business_name" && report.business_id && value) {
        await supabaseAdmin.from("businesses").update({ name_ar: value }).eq("id", report.business_id);
        applied = true;
      } else if (field === "business_category" && report.business_id && value) {
        await supabaseAdmin.from("businesses").update({ category: value }).eq("id", report.business_id);
        applied = true;
      } else if (field === "place_category" && value) {
        if (report.business_id) {
          await supabaseAdmin
            .from("businesses")
            .update({ place_category: value })
            .eq("id", report.business_id);
        }
        if (report.node_id) {
          await supabaseAdmin
            .from("location_nodes")
            .update({ place_category: value })
            .eq("id", report.node_id);
        }
        applied = true;
      } else if (field === "business_status" && report.business_id) {
        await supabaseAdmin
          .from("businesses")
          .update({ is_published: false, is_archived: true })
          .eq("id", report.business_id);
        applied = true;
      } else {
        appliedNote = "هذا النوع يحتاج تعديلاً يدوياً — سُجّل القرار فقط";
      }
    }

    const status =
      data.decision === "approved" ? "approved" : data.decision === "rejected" ? "rejected" : "under_review";

    const { error } = await supa
      .from("correction_reports")
      .update({
        status,
        decision: data.decision,
        decision_note: [data.note?.trim(), appliedNote].filter(Boolean).join(" · ") || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        applied,
        applied_at: applied ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await supa.from("audit_logs").insert({
      actor_id: context.userId,
      action: `correction_${data.decision}`,
      resource_type: "correction_report",
      resource_id: data.id,
      metadata: { applied, target_field: report.target_field },
    });

    return { ok: true, applied };
  });

export const getBusinessProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { serverPublicClient } = await import("./addresses.server");
    const supa = serverPublicClient();
    const { data: biz, error } = await supa
      .from("businesses")
      .select(
        "id, name_ar, name_en, category, phone, website, opening_hours, logo_url, verification_level, node_id, visitor_access_point_id, delivery_access_point_id, smart_addresses(code), location_nodes(display_name, governorate, city, district, neighborhood, street, landmark, latitude, longitude, confidence_score)",
      )
      .eq("id", data.id)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!biz) return { status: "not_found" as const };

    const apIds = [biz.visitor_access_point_id, biz.delivery_access_point_id].filter(
      (v): v is string => Boolean(v),
    );
    let accessPoints: {
      id: string;
      display_name: string;
      access_type: string;
      latitude: number | null;
      longitude: number | null;
      instructions_ar: string | null;
      always_open: boolean;
      opens_at: string | null;
      closes_at: string | null;
      accessibility: string[];
    }[] = [];
    if (apIds.length) {
      const { data: aps } = await supa
        .from("access_points")
        .select(
          "id, display_name, access_type, latitude, longitude, instructions_ar, always_open, opens_at, closes_at, accessibility",
        )
        .in("id", [...new Set(apIds)]);
      accessPoints = (aps ?? []) as typeof accessPoints;
    }

    return {
      status: "ok" as const,
      business: {
        id: biz.id,
        name_ar: biz.name_ar,
        name_en: biz.name_en,
        category: biz.category,
        phone: biz.phone,
        website: biz.website,
        opening_hours: biz.opening_hours,
        logo_url: biz.logo_url,
        verification_level: biz.verification_level,
      },
      node: Array.isArray(biz.location_nodes) ? biz.location_nodes[0] : biz.location_nodes,
      smart_code:
        (Array.isArray(biz.smart_addresses) ? biz.smart_addresses[0] : biz.smart_addresses)?.code ?? null,
      visitor_access_point:
        accessPoints.find((a) => a.id === biz.visitor_access_point_id) ?? null,
      delivery_access_point:
        accessPoints.find((a) => a.id === biz.delivery_access_point_id) ?? null,
    };
  });

export const claimBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ business_id: z.string().uuid(), evidence: z.string().max(600).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { data: existing } = await supa
      .from("business_claims")
      .select("id, status")
      .eq("business_id", data.business_id)
      .eq("claimant_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.status === "pending") return { status: "already_pending" as const };
    if (existing?.status === "approved") return { status: "already_owner" as const };

    const { error } = await supa.from("business_claims").insert({
      business_id: data.business_id,
      claimant_id: context.userId,
      evidence: data.evidence ?? null,
    });
    if (error) throw new Error(error.message);

    await supa.from("audit_logs").insert({
      actor_id: context.userId,
      action: "business_claim_submitted",
      resource_type: "business",
      resource_id: data.business_id,
      metadata: {},
    });
    return { status: "submitted" as const };
  });

export const reviewClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supa = context.supabase;
    const { data: isAdmin } = await supa.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isModerator } = await supa.rpc("has_role", {
      _user_id: context.userId,
      _role: "moderator",
    });
    if (!isAdmin && !isModerator) throw new Error("Forbidden");

    const { data: claim, error } = await supa
      .from("business_claims")
      .update({ status: data.status, reviewed_by: context.userId })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id, business_id, claimant_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claim) return { ok: false as const };

    if (data.status === "approved") {
      await supa
        .from("businesses")
        .update({ owner_id: claim.claimant_id, verification_level: "owner_verified" })
        .eq("id", claim.business_id);
    }

    await supa.from("audit_logs").insert({
      actor_id: context.userId,
      action: `business_claim_${data.status}`,
      resource_type: "business_claim",
      resource_id: claim.id,
      metadata: { business_id: claim.business_id },
    });
    return { ok: true as const };
  });

export const networkStats = createServerFn({ method: "GET" }).handler(async () => {
  const { serverPublicClient } = await import("./addresses.server");
  const supa = serverPublicClient();
  const count = async (table: "location_nodes" | "access_points" | "smart_addresses" | "businesses") => {
    const { count: n } = await supa.from(table).select("*", { count: "exact", head: true });
    return n ?? 0;
  };
  const [nodes, accessPoints, codes, businesses] = await Promise.all([
    count("location_nodes"),
    count("access_points"),
    count("smart_addresses"),
    count("businesses"),
  ]);
  return { nodes, accessPoints, codes, businesses };
});

export const adminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isModerator } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "moderator",
    });
    if (!isAdmin && !isModerator) {
      return { authorized: false as const };
    }

    const supa = context.supabase;
    const head = async (table: "location_nodes" | "access_points" | "smart_addresses" | "businesses" | "temporary_addresses" | "correction_reports" | "duplicate_candidates" | "visit_feedback") => {
      const { count } = await supa.from(table).select("*", { count: "exact", head: true });
      return count ?? 0;
    };

    const [nodes, accessPoints, codes, businesses, temporary, corrections, duplicates, visits] =
      await Promise.all([
        head("location_nodes"),
        head("access_points"),
        head("smart_addresses"),
        head("businesses"),
        head("temporary_addresses"),
        head("correction_reports"),
        head("duplicate_candidates"),
        head("visit_feedback"),
      ]);

    const { data: pending } = await supa
      .from("correction_reports")
      .select("id, issue_type, details, smart_code, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: recentFeedback } = await supa
      .from("visit_feedback")
      .select("id, smart_code, purpose, successful, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    const { count: successfulVisits } = await supa
      .from("visit_feedback")
      .select("*", { count: "exact", head: true })
      .eq("successful", true);

    const { data: pendingClaims } = await supa
      .from("business_claims")
      .select("id, evidence, status, created_at, businesses(name_ar)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      authorized: true as const,
      is_admin: Boolean(isAdmin),
      metrics: { nodes, accessPoints, codes, businesses, temporary, corrections, duplicates, visits },
      pending: pending ?? [],
      feedback: recentFeedback ?? [],
      claims: pendingClaims ?? [],
      successRate: visits > 0 ? Math.round(((successfulVisits ?? 0) / visits) * 100) : null,
    };
  });
