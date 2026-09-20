/**
 * Navigation RPC surface.
 *
 * Thin wrappers only: every runtime helper lives in a server-only module that
 * is imported inside the handler, so routing credentials never reach the
 * browser bundle.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const coordSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const modeSchema = z.enum(["driving", "walking", "cycling", "delivery", "heavy"]);
const langSchema = z.enum(["ar", "en"]).default("ar");
const codeSchema = z.string().min(4).max(40);

/** Public destination payload: entrances, chosen point, public arrival card. */
export const getNavigationTarget = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        code: codeSchema,
        mode: modeSchema.default("driving"),
        entranceId: z.string().uuid().nullish(),
        wheelchair: z.boolean().default(false),
        purpose: z.string().max(40).default("visitor"),
        context: z.string().max(40).optional(),
        lang: langSchema,
        shareToken: z.string().max(120).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const nav = await import("./navigation.server");
    const { serverPublicClient } = await import("../addresses.server");
    const supa = serverPublicClient();

    const address = await nav.resolveForNavigation(data.code, supa);
    if (!address) return { ok: false as const, error: "destination_unavailable" as const };

    let privateLinkGranted = false;
    if (data.shareToken) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const redemption = await nav.redeemShare(data.shareToken, supabaseAdmin);
      privateLinkGranted = redemption.ok && redemption.share.share_type === "private_delivery";
    }

    if (!address.is_public && !privateLinkGranted) {
      return { ok: false as const, error: "destination_unavailable" as const };
    }

    const { routingContext } = await import("../routing-contexts");
    const ctx = routingContext(data.context);
    const selection = nav.selectDestination(address, {
      mode: data.mode,
      entranceId: data.entranceId ?? null,
      wheelchair: data.wheelchair || ctx.requireWheelchair,
      purpose: data.purpose,
      context: ctx.value,
    });
    const destination = nav.buildDestination(address, selection, data.mode, ctx.value);
    const arrival = await nav.lastMetreCard(
      address,
      destination.entrance_id,
      { userId: null, isOwner: false, isStaff: false, privateLinkGranted },
      supa as never,
      data.lang,
    );

    return {
      ok: true as const,
      destination,
      arrival,
      entrances: address.entrances,
      road_access_points: address.road_access_points,
      property: {
        smart_code: address.smart_code,
        name: address.property_name,
        node_type: address.node_type,
        city: address.city,
        neighborhood: address.neighborhood,
        street: address.street,
        landmark: address.landmark,
        confidence_score: address.confidence_score,
        verification_level: address.verification_level,
        point: address.property_point,
      },
    };
  });

/** Owner/staff view — may include unit, intercom and delivery notes. */
export const getNavigationTargetAuthed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: codeSchema,
        mode: modeSchema.default("driving"),
        entranceId: z.string().uuid().nullish(),
        wheelchair: z.boolean().default(false),
        purpose: z.string().max(40).default("visitor"),
        context: z.string().max(40).optional(),
        lang: langSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const nav = await import("./navigation.server");
    const supa = context.supabase;

    const address = await nav.resolveForNavigation(data.code, supa);
    if (!address) return { ok: false as const, error: "destination_unavailable" as const };

    const { routingContext } = await import("../routing-contexts");
    const ctx = routingContext(data.context);
    const selection = nav.selectDestination(address, {
      mode: data.mode,
      entranceId: data.entranceId ?? null,
      wheelchair: data.wheelchair || ctx.requireWheelchair,
      purpose: data.purpose,
      context: ctx.value,
    });
    const destination = nav.buildDestination(address, selection, data.mode, ctx.value);
    const viewer = await nav.viewerContext(address, context.userId, supa);
    const arrival = await nav.lastMetreCard(address, destination.entrance_id, viewer, supa, data.lang);

    return {
      ok: true as const,
      destination,
      arrival,
      entrances: address.entrances,
      road_access_points: address.road_access_points,
      property: {
        smart_code: address.smart_code,
        name: address.property_name,
        node_type: address.node_type,
        city: address.city,
        neighborhood: address.neighborhood,
        street: address.street,
        landmark: address.landmark,
        confidence_score: address.confidence_score,
        verification_level: address.verification_level,
        point: address.property_point,
      },
    };
  });

/** Road-level route between two points. Provider stays server-side. */
export const calculateRoute = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        origin: coordSchema,
        destination: coordSchema,
        mode: modeSchema.default("driving"),
        alternatives: z.boolean().default(true),
        smartCode: codeSchema.nullish(),
        originMethod: z.string().max(30).nullish(),
        destinationKind: z.string().max(40).nullish(),
        city: z.string().max(60).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const started = Date.now();
    const { routingProvider, routingConfigured, straightLineRoute, NavigationError } = await import(
      "./providers.server"
    );
    const { haversineMeters } = await import("./geo");
    const nav = await import("./navigation.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;

    const analytics = {
      smart_code: data.smartCode ?? null,
      travel_mode: data.mode,
      origin_method: data.originMethod ?? null,
      destination_kind: data.destinationKind ?? null,
      city: data.city ?? null,
    };

    const straightDistance = haversineMeters(data.origin, data.destination);

    if (!routingConfigured()) {
      await nav.trackNavEvent(admin, "route_generation_failed", {
        ...analytics,
        provider: "unconfigured",
        success: false,
      });
      return {
        ok: true as const,
        degraded: true as const,
        error: "routing_not_configured" as const,
        bundle: {
          primary: straightLineRoute(data.origin, data.destination, data.mode, straightDistance),
          alternatives: [],
        },
      };
    }

    const allowed = await nav.rateLimit(admin, "route_generated", 240);
    if (!allowed) {
      return { ok: false as const, error: "rate_limited" as const };
    }

    try {
      const provider = routingProvider();
      const bundle = data.alternatives
        ? await provider.calculateAlternatives(data.origin, data.destination, data.mode)
        : {
            primary: await provider.calculateRoute(data.origin, data.destination, data.mode),
            alternatives: [],
          };

      await nav.trackNavEvent(admin, "route_generated", {
        ...analytics,
        provider: provider.id,
        success: true,
        duration_ms: Date.now() - started,
      });
      return { ok: true as const, degraded: false as const, bundle };
    } catch (err) {
      const code =
        err instanceof NavigationError ? err.code : ("routing_service_unavailable" as const);
      console.error("[navigation] route failed", code, err);
      await nav.trackNavEvent(admin, "route_generation_failed", {
        ...analytics,
        provider: "openrouteservice",
        success: false,
        duration_ms: Date.now() - started,
      });

      if (code === "no_route_found" || code === "rate_limited") {
        return { ok: false as const, error: code };
      }
      // Degraded but useful: straight-line estimate, clearly flagged.
      const { straightLineRoute: fallback } = await import("./providers.server");
      return {
        ok: true as const,
        degraded: true as const,
        error: code,
        bundle: {
          primary: fallback(data.origin, data.destination, data.mode, straightDistance),
          alternatives: [],
        },
      };
    }
  });

/** OSM geocoding, used only when our own database has no answer. */
export const geocodePlace = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(2).max(120), lang: langSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { geocodeExternal } = await import("./providers.server");
    return { hits: await geocodeExternal(data.query, data.lang) };
  });

export const reverseGeocodePoint = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ point: coordSchema, lang: langSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const { reverseGeocodeExternal } = await import("./providers.server");
    return { hit: await reverseGeocodeExternal(data.point, data.lang) };
  });

/** Create a public destination link or a revocable private delivery link. */
export const createRouteShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        smartCode: codeSchema,
        entranceId: z.string().uuid().nullish(),
        mode: modeSchema.default("driving"),
        shareType: z.enum(["public_destination", "private_delivery"]),
        expiresInHours: z.number().int().min(1).max(720).default(48),
        oneTime: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const nav = await import("./navigation.server");
    const supa = context.supabase;

    const address = await nav.resolveForNavigation(data.smartCode, supa);
    if (!address) return { ok: false as const, error: "destination_unavailable" as const };

    if (data.shareType === "private_delivery") {
      const viewer = await nav.viewerContext(address, context.userId, supa);
      if (!viewer.isOwner && !viewer.isStaff) {
        return { ok: false as const, error: "forbidden" as const };
      }
    }

    const token = nav.generateShareToken();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;

    const { error } = await admin.from("route_shares").insert({
      token,
      smart_address_id: address.smart_address_id,
      node_id: address.node_id,
      access_point_id: data.entranceId ?? null,
      travel_mode: data.mode,
      share_type: data.shareType,
      one_time: data.oneTime,
      expires_at: new Date(Date.now() + data.expiresInHours * 3_600_000).toISOString(),
      created_by: context.userId,
    });
    if (error) {
      console.error("[navigation] share insert failed", error.message);
      return { ok: false as const, error: "share_failed" as const };
    }

    if (data.shareType === "private_delivery") {
      await nav.trackNavEvent(admin, "private_route_shared", {
        smart_code: address.smart_code,
        travel_mode: data.mode,
      });
    }
    return { ok: true as const, token, share_type: data.shareType };
  });

export const revokeRouteShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("route_shares")
      .update({ revoked: true })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const listMyRouteShares = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("route_shares")
      .select(
        "id, token, share_type, travel_mode, one_time, revoked, expires_at, access_count, created_at, smart_addresses(code)",
      )
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { shares: data ?? [] };
  });

/** Community road / entrance problem report — enters the moderation queue. */
export const reportRouteProblem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.string().min(3).max(40),
        description: z.string().max(1200).nullish(),
        smartCode: codeSchema.nullish(),
        entranceId: z.string().uuid().nullish(),
        point: coordSchema.nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sanitize = (value: string | null | undefined) =>
      value ? value.replace(/[<>]/g, "").trim().slice(0, 1200) : null;

    let smartAddressId: string | null = null;
    let nodeId: string | null = null;
    if (data.smartCode) {
      const { data: sa } = await context.supabase
        .from("smart_addresses")
        .select("id, node_id")
        .eq("code", data.smartCode.trim().toUpperCase())
        .maybeSingle();
      smartAddressId = sa?.id ?? null;
      nodeId = sa?.node_id ?? null;
    }

    const { error } = await context.supabase.from("route_reports").insert({
      reporter_id: context.userId,
      smart_address_id: smartAddressId,
      node_id: nodeId,
      access_point_id: data.entranceId ?? null,
      category: data.category,
      description: sanitize(data.description),
      latitude: data.point?.latitude ?? null,
      longitude: data.point?.longitude ?? null,
      status: "pending",
    });
    if (error) {
      console.error("[navigation] report failed", error.message);
      return { ok: false as const, error: error.message };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nav = await import("./navigation.server");
    await nav.trackNavEvent(supabaseAdmin, "route_problem_reported", {
      smart_code: data.smartCode ?? null,
    });
    return { ok: true as const };
  });

/**
 * Multi-stop optimisation. Only coordinates and anonymous stop references
 * leave the server — never names, phone numbers or unit details.
 */
export const optimizeCourierRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().max(120).default("مسار توصيل"),
        mode: modeSchema.default("delivery"),
        start: coordSchema,
        end: coordSchema.nullish(),
        stops: z
          .array(
            z.object({
              ref: z.string().max(60),
              smartCode: codeSchema.nullish(),
              location: coordSchema,
              serviceTimeS: z.number().int().min(0).max(7200).optional(),
              priority: z.number().int().min(0).max(100).optional(),
              windowStartS: z.number().int().min(0).optional(),
              windowEndS: z.number().int().min(0).optional(),
              locked: z.boolean().optional(),
            }),
          )
          .min(2)
          .max(50),
        save: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { routingProvider, routingConfigured, NavigationError } = await import("./providers.server");
    const nav = await import("./navigation.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin;

    if (!routingConfigured()) {
      return { ok: false as const, error: "routing_not_configured" as const };
    }
    if (!(await nav.rateLimit(admin, "multi_stop_route_created", 30))) {
      return { ok: false as const, error: "rate_limited" as const };
    }

    try {
      const provider = routingProvider();
      const result = await provider.optimizeStops(
        data.start,
        data.end ?? null,
        data.stops.map((s) => ({
          ref: s.ref,
          location: s.location,
          ...(s.serviceTimeS != null ? { service_time_s: s.serviceTimeS } : {}),
          ...(s.priority != null ? { priority: s.priority } : {}),
          ...(s.windowStartS != null ? { window_start_s: s.windowStartS } : {}),
          ...(s.windowEndS != null ? { window_end_s: s.windowEndS } : {}),
        })),
        data.mode,
      );

      let routeId: string | null = null;
      if (data.save) {
        const { data: saved } = await context.supabase
          .from("courier_routes")
          .insert({
            owner_id: context.userId,
            name: data.name,
            vehicle_type: data.mode,
            status: "planned",
            total_distance_m: result.total_distance_m,
            total_duration_s: result.total_duration_s,
            optimized_at: new Date().toISOString(),
            start_latitude: data.start.latitude,
            start_longitude: data.start.longitude,
            end_latitude: data.end?.latitude ?? null,
            end_longitude: data.end?.longitude ?? null,
          })
          .select("id")
          .maybeSingle();
        routeId = saved?.id ?? null;

        if (routeId) {
          const positionOf = new Map(result.order.map((o, i) => [o.ref, i]));
          const etaOf = new Map(result.order.map((o) => [o.ref, o.arrival_s]));
          await context.supabase.from("courier_route_stops").insert(
            data.stops.map((stop, index) => ({
              route_id: routeId as string,
              position: index,
              optimized_position: positionOf.get(stop.ref) ?? null,
              eta_seconds: etaOf.get(stop.ref) ?? null,
              label: stop.ref,
              smart_code: stop.smartCode ?? null,
              latitude: stop.location.latitude,
              longitude: stop.location.longitude,
              locked: stop.locked ?? false,
              priority: stop.priority ?? 0,
              service_time_s: stop.serviceTimeS ?? 180,
              unreachable: result.unassigned.includes(stop.ref),
            })),
          );
        }
      }

      await nav.trackNavEvent(admin, "multi_stop_route_created", {
        travel_mode: data.mode,
        provider: result.provider,
        success: true,
      });
      return { ok: true as const, result, routeId };
    } catch (err) {
      const code = err instanceof NavigationError ? err.code : ("routing_service_unavailable" as const);
      console.error("[navigation] optimisation failed", code, err);
      return { ok: false as const, error: code };
    }
  });

export const listCourierRoutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("courier_routes")
      .select(
        "id, name, vehicle_type, status, total_distance_m, total_duration_s, created_at, courier_route_stops(id, label, smart_code, latitude, longitude, position, optimized_position, eta_seconds, locked, unreachable)",
      )
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return { routes: data ?? [] };
  });

/** Fire-and-forget product analytics from the client. No coordinates accepted. */
export const trackNavigationEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        event: z.enum([
          "directions_requested",
          "navigation_started",
          "navigation_completed",
          "navigation_abandoned",
          "origin_method_selected",
          "travel_mode_selected",
          "entrance_changed",
          "smart_address_searched",
          "business_directions_requested",
          "location_permission_granted",
          "location_permission_denied",
        ]),
        smartCode: codeSchema.nullish(),
        travelMode: modeSchema.nullish(),
        originMethod: z.string().max(30).nullish(),
        destinationKind: z.string().max(40).nullish(),
        city: z.string().max(60).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nav = await import("./navigation.server");
    await nav.trackNavEvent(supabaseAdmin, data.event, {
      smart_code: data.smartCode ?? null,
      travel_mode: data.travelMode ?? null,
      origin_method: data.originMethod ?? null,
      destination_kind: data.destinationKind ?? null,
      city: data.city ?? null,
    });
    return { ok: true as const };
  });
