import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const purposeSchema = z.string().min(2).max(40);

export const resolveAddress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(4).max(32),
        purpose: purposeSchema.default("visitor"),
        wheelchair: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolvePublicCode } = await import("./addresses.server");
    return resolvePublicCode(data.code, data.purpose as never, {
      requireWheelchair: data.wheelchair ?? false,
    });
  });

export const searchNetwork = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().max(120) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { serverPublicClient } = await import("./addresses.server");
    const { normalizeArabic, normalizeCode } = await import("./smart-address");
    const supa = serverPublicClient();
    const raw = data.query.trim();
    if (raw.length < 2) return { businesses: [], places: [], code: null };

    const pattern = `%${raw}%`;
    const normalized = normalizeArabic(raw);

    const [businessRes, placeRes, aliasRes, codeRes] = await Promise.all([
      supa
        .from("businesses")
        .select(
          "id, name_ar, name_en, category, phone, website, opening_hours, verification_level, node_id, visitor_access_point_id, delivery_access_point_id, smart_addresses(code), location_nodes(display_name, governorate, city, district, neighborhood, unit_label, floor_label)",
        )
        .eq("is_published", true)
        .or(`name_ar.ilike.${pattern},name_en.ilike.${pattern},category.ilike.${pattern}`)
        .limit(20),
      supa
        .from("location_nodes")
        .select(
          "id, display_name, name_en, node_type, governorate, city, district, neighborhood, street, landmark, verification_level, confidence_score, latitude, longitude",
        )
        .eq("visibility", "public")
        .eq("is_active", true)
        .or(
          `display_name.ilike.${pattern},name_en.ilike.${pattern},neighborhood.ilike.${pattern},street.ilike.${pattern},landmark.ilike.${pattern}`,
        )
        .limit(20),
      supa.from("location_aliases").select("node_id, alias").ilike("alias", pattern).limit(20),
      supa
        .from("smart_addresses")
        .select("code, label")
        .eq("is_public", true)
        .ilike("code", `%${normalizeCode(raw)}%`)
        .limit(5),
    ]);

    const aliasNodeIds = (aliasRes.data ?? []).map((a) => a.node_id);
    let aliasPlaces: NonNullable<typeof placeRes.data> = [];
    if (aliasNodeIds.length) {
      const { data: extra } = await supa
        .from("location_nodes")
        .select(
          "id, display_name, name_en, node_type, governorate, city, district, neighborhood, street, landmark, verification_level, confidence_score, latitude, longitude",
        )
        .in("id", aliasNodeIds)
        .eq("visibility", "public")
        .eq("is_active", true);
      aliasPlaces = extra ?? [];
    }

    const placeMap = new Map<string, (typeof aliasPlaces)[number]>();
    for (const p of [...(placeRes.data ?? []), ...aliasPlaces]) placeMap.set(p.id, p);

    const businesses = (businessRes.data ?? []).sort((a, b) => {
      const exact = (x: typeof a) =>
        normalizeArabic(x.name_ar) === normalized || (x.name_en ?? "").toLowerCase() === raw.toLowerCase() ? 1 : 0;
      const verified = (x: typeof a) => (x.verification_level === "unverified" ? 0 : 1);
      return exact(b) - exact(a) || verified(b) - verified(a);
    });

    return {
      businesses,
      places: [...placeMap.values()].sort((a, b) => b.confidence_score - a.confidence_score),
      code: codeRes.data?.[0] ?? null,
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
  is_public: z.boolean().default(false),
  business: z
    .object({
      name_ar: z.string().min(2).max(120),
      name_en: z.string().max(120).optional(),
      category: z.string().max(80).optional(),
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
          visibility: "public",
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
          visibility: data.is_public ? "public" : "private",
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
          visibility: data.is_public ? "public" : "private",
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
        is_public: data.is_public,
        created_by: userId,
      })
      .select("id, code")
      .single();
    if (codeError) throw new Error(codeError.message);

    if (data.business) {
      await supa.from("businesses").insert({
        name_ar: data.business.name_ar,
        name_en: data.business.name_en ?? null,
        category: data.business.category ?? null,
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
    }

    await supa.from("audit_logs").insert({
      actor_id: userId,
      action: "address_created",
      resource_type: "smart_address",
      resource_id: smart.id,
      metadata: { code: smart.code, intent: data.intent, is_public: data.is_public },
    });

    return { code: smart.code, smart_address_id: smart.id, node_id: targetNodeId };
  });

export const listMyAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("smart_addresses")
      .select(
        "id, code, label, is_public, status, created_at, location_nodes(display_name, node_type, unit_label, floor_label, neighborhood, city, governorate, visibility, latitude, longitude, confidence_score, verification_level), access_points(display_name, access_type, latitude, longitude)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTemporaryAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        smart_address_id: z.string().uuid(),
        purpose: purposeSchema.default("parcel_delivery"),
        hours: z.number().int().min(1).max(720).default(24),
        one_use: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    const token = `SY-TMP-${Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")}`;
    const expires = new Date(Date.now() + data.hours * 3600_000).toISOString();

    const { data: row, error } = await context.supabase
      .from("temporary_addresses")
      .insert({
        token,
        smart_address_id: data.smart_address_id,
        purpose: data.purpose,
        expires_at: expires,
        max_uses: data.one_use ? 1 : null,
        created_by: context.userId,
      })
      .select("token, expires_at, purpose, max_uses")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "temporary_address_created",
      resource_type: "temporary_address",
      resource_id: token,
      metadata: { purpose: data.purpose, hours: data.hours },
    });

    return row;
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
      .select("id, purpose, expires_at, max_uses, use_count, revoked, smart_address_id")
      .eq("token", token)
      .maybeSingle();

    if (!temp) return { status: "not_found" as const };
    if (temp.revoked) return { status: "revoked" as const };
    if (new Date(temp.expires_at).getTime() < Date.now()) return { status: "expired" as const };
    if (temp.max_uses != null && temp.use_count >= temp.max_uses) return { status: "expired" as const };

    const { data: smart } = await supabaseAdmin
      .from("smart_addresses")
      .select("code, node_id, default_access_point_id")
      .eq("id", temp.smart_address_id)
      .maybeSingle();
    if (!smart) return { status: "not_found" as const };

    // Purpose-limited disclosure: destination hierarchy only, no account data.
    const chain: { node_type: string; label: string }[] = [];
    let currentId: string | null = smart.node_id;
    let site: { display_name: string; latitude: number | null; longitude: number | null; neighborhood: string | null; city: string | null } | null = null;
    for (let i = 0; i < 8 && currentId; i += 1) {
      const nodeResult = await supabaseAdmin
        .from("location_nodes")
        .select("id, parent_id, node_type, display_name, unit_label, floor_label, latitude, longitude, neighborhood, city")
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
      } | null;
      if (!node) break;
      chain.unshift({
        node_type: node.node_type,
        label: node.unit_label ?? node.floor_label ?? node.display_name,
      });
      site = {
        display_name: node.display_name,
        latitude: node.latitude,
        longitude: node.longitude,
        neighborhood: node.neighborhood,
        city: node.city,
      };
      currentId = node.parent_id;
    }

    let accessPoint: {
      display_name: string;
      latitude: number | null;
      longitude: number | null;
      instructions_ar: string | null;
      opens_at: string | null;
      closes_at: string | null;
    } | null = null;
    if (smart.default_access_point_id) {
      const { data: ap } = await supabaseAdmin
        .from("access_points")
        .select("display_name, latitude, longitude, instructions_ar, opens_at, closes_at")
        .eq("id", smart.default_access_point_id)
        .maybeSingle();
      accessPoint = ap ?? null;
    }

    await supabaseAdmin
      .from("temporary_addresses")
      .update({ use_count: temp.use_count + 1 })
      .eq("id", temp.id);

    return {
      status: "ok" as const,
      token,
      purpose: temp.purpose,
      expires_at: temp.expires_at,
      site,
      chain,
      access_point: accessPoint,
    };
  });

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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("correction_reports").insert({
      smart_code: data.smart_code ?? null,
      issue_type: data.issue_type,
      details: data.details ?? null,
      node_id: data.node_id ?? null,
      access_point_id: data.access_point_id ?? null,
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

export const reviewCorrection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["reviewed", "dismissed"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS restricts this update to moderators/admins.
    const { error } = await context.supabase
      .from("correction_reports")
      .update({ status: data.status, reviewed_by: context.userId })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getBusinessProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { serverPublicClient } = await import("./addresses.server");
    const supa = serverPublicClient();
    const { data: biz, error } = await supa
      .from("businesses")
      .select(
        "id, name_ar, name_en, category, phone, website, opening_hours, verification_level, node_id, visitor_access_point_id, delivery_access_point_id, smart_addresses(code), location_nodes(display_name, governorate, city, district, neighborhood, street, landmark, latitude, longitude, confidence_score)",
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
