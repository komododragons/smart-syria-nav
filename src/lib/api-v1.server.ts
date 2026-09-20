/**
 * Syriasan Developer API v1 — server-only dispatcher.
 *
 * Every request is authenticated with a hashed API key, checked against the
 * key's scopes, rate limited per client, metered into `api_usage` and — for
 * state changing calls — written to `audit_logs`.
 *
 * Privacy rule (non negotiable): this API only ever exposes PUBLIC smart
 * addresses. Private residential nodes resolve to `{"error":"private"}` with
 * no hierarchy, coordinates, owner or contact data disclosed.
 */
import { createHash } from "node:crypto";

import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type Admin = SupabaseClient<Database>;

export const API_SCOPES = [
  "addresses:read",
  "addresses:write",
  "resolve",
  "search",
  "validate",
  "geocode",
  "route",
  "qr",
  "keys:manage",
  "webhooks:manage",
] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const DEFAULT_READ_SCOPES: ApiScope[] = [
  "addresses:read",
  "resolve",
  "search",
  "validate",
  "geocode",
  "route",
  "qr",
];

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-api-key",
  "Access-Control-Max-Age": "600",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
  });
}

function fail(error: string, status: number, message: string, extra: Record<string, string> = {}) {
  return json({ error, message }, status, extra);
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// ---------------------------------------------------------------- auth

type AuthOk = {
  ok: true;
  clientId: string;
  keyId: string;
  ownerId: string | null;
  scopes: ApiScope[];
  limit: number;
  used: number;
  /** `test` keys run in sandbox mode: reads are real, writes are simulated. */
  environment: "live" | "test";
};

async function authenticate(request: Request, admin: Admin): Promise<AuthOk | Response> {
  const bearer = request.headers.get("authorization");
  const raw =
    request.headers.get("x-api-key") ??
    (bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : null);

  if (!raw) {
    return fail(
      "missing_api_key",
      401,
      "Provide your key as `Authorization: Bearer san_live_…` or the `x-api-key` header.",
    );
  }
  if (!raw.startsWith("san_")) return fail("invalid_api_key", 401, "Malformed API key.");

  const { data: keyRow } = await admin
    .from("api_keys")
    .select("id, client_id, revoked, expires_at, scopes")
    .eq("key_hash", hashApiKey(raw))
    .maybeSingle();

  if (!keyRow) return fail("invalid_api_key", 401, "Unknown API key.");
  if (keyRow.revoked) return fail("revoked_api_key", 401, "This API key has been revoked.");
  if (keyRow.expires_at && new Date(keyRow.expires_at).getTime() < Date.now()) {
    return fail("expired_api_key", 401, "This API key has expired.");
  }

  const { data: client } = await admin
    .from("api_clients")
    .select("id, owner_id, scopes, rate_limit_per_minute, is_active, environment")
    .eq("id", keyRow.client_id)
    .maybeSingle();
  if (!client || !client.is_active) {
    return fail("inactive_client", 403, "The API client for this key is inactive.");
  }

  // Key scopes narrow the client scopes; an empty key scope list inherits them.
  const clientScopes = (client.scopes?.length ? client.scopes : DEFAULT_READ_SCOPES) as ApiScope[];
  const keyScopes = (keyRow.scopes ?? []) as ApiScope[];
  const scopes = keyScopes.length
    ? clientScopes.filter((s) => keyScopes.includes(s))
    : clientScopes;

  const limit = client.rate_limit_per_minute ?? 60;
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("client_id", client.id)
    .gte("created_at", since);
  const used = count ?? 0;

  if (used >= limit) {
    return fail("rate_limited", 429, `Rate limit of ${limit} requests/minute exceeded.`, {
      "Retry-After": "60",
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": "0",
    });
  }

  return {
    ok: true,
    clientId: client.id,
    keyId: keyRow.id,
    ownerId: client.owner_id,
    scopes,
    limit,
    used,
    environment: client.environment === "test" ? "test" : "live",
  };
}

async function meter(
  admin: Admin,
  auth: AuthOk,
  endpoint: string,
  method: string,
  status: number,
  scope: string,
  startedAt: number,
) {
  try {
    await admin.from("api_usage").insert({
      client_id: auth.clientId,
      endpoint,
      method,
      status_code: status,
      scope,
      response_ms: Date.now() - startedAt,
    });
    await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", auth.keyId);
  } catch {
    /* metering must never break a response */
  }
}

async function audit(
  admin: Admin,
  auth: AuthOk,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown>,
) {
  try {
    await admin.from("audit_logs").insert({
      actor_id: auth.ownerId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata: { ...metadata, via: "api_v1", api_client_id: auth.clientId },
    });
  } catch {
    /* never block the response */
  }
}

// ---------------------------------------------------------------- helpers

const SYRIA_BBOX = { minLat: 32.0, maxLat: 37.4, minLng: 35.5, maxLng: 42.5 };
const CODE_RE = /^SY-[A-Z]{3}-[0-9A-Z]{4}(-[0-9A-Z]{2})?$/i;

function inSyria(lat: number, lng: number) {
  return (
    lat >= SYRIA_BBOX.minLat && lat <= SYRIA_BBOX.maxLat && lng >= SYRIA_BBOX.minLng && lng <= SYRIA_BBOX.maxLng
  );
}

function publicAddressPayload(result: Extract<
  Awaited<ReturnType<typeof import("./addresses.server").resolvePublicCode>>,
  { status: "ok" }
>) {
  return {
    code: result.code,
    verification_level: result.verification_level,
    confidence: result.confidence,
    location: {
      governorate: result.site.governorate,
      city: result.site.city,
      district: (result.site as { district?: string | null }).district ?? null,
      neighborhood: result.site.neighborhood,
      street: result.site.street,
      landmark: result.site.landmark,
      display_name: result.site.display_name,
      latitude: result.site.latitude ?? null,
      longitude: result.site.longitude ?? null,
    },
    entrance: result.recommended
      ? {
          name: result.recommended.display_name,
          access_type: result.recommended.access_type,
          latitude: result.recommended.latitude,
          longitude: result.recommended.longitude,
          instructions: result.recommended.instructions,
          open_now: result.recommended.open_now,
          accessibility: result.recommended.accessibility,
        }
      : null,
    alternatives: result.alternatives.map((ap) => ({
      name: ap.display_name,
      latitude: ap.latitude,
      longitude: ap.longitude,
      open_now: ap.open_now,
    })),
    business: result.business
      ? {
          name_ar: result.business.name_ar,
          name_en: result.business.name_en,
          category: result.business.category,
          phone: result.business.phone,
          website: result.business.website,
          opening_hours: result.business.opening_hours,
          verification_level: result.business.verification_level,
        }
      : null,
    links: {
      address_page: `https://syriasan.com/a/${result.code}`,
      delivery_page: `https://syriasan.com/d/${result.code}`,
      qr: `https://syriasan.com/api/public/v1/qr/${result.code}`,
    },
  };
}

// ---------------------------------------------------------------- endpoints

async function createAddress(body: unknown, admin: Admin, auth: AuthOk) {
  const schema = z.object({
    name_ar: z.string().trim().min(2).max(120),
    name_en: z.string().trim().max(120).optional(),
    governorate: z.string().trim().min(2).max(40),
    governorate_code: z.string().trim().length(3),
    city: z.string().trim().max(60).optional(),
    district: z.string().trim().max(60).optional(),
    neighborhood: z.string().trim().max(60).optional(),
    street: z.string().trim().max(120).optional(),
    building_number: z.string().trim().max(30).optional(),
    landmark: z.string().trim().max(160).optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    entrance_name: z.string().trim().max(80).optional(),
    entrance_instructions: z.string().trim().max(400).optional(),
    parking_info: z.string().trim().max(300).optional(),
    loading_info: z.string().trim().max(300).optional(),
    category: z.string().trim().max(60).optional(),
    phone: z.string().trim().max(30).optional(),
    label: z.string().trim().max(80).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid_request", 400, "Validation failed.", {}) as Response;
  }
  const d = parsed.data;
  if (!inSyria(d.latitude, d.longitude)) {
    return fail("out_of_bounds", 422, "Coordinates must fall inside Syria.");
  }

  // Sandbox: `test` keys get the full validated response without touching data.
  if (auth.environment === "test") {
    const sample = `SY-${d.governorate_code.toUpperCase()}-TEST`;
    return json(
      {
        mode: "test",
        code: sample,
        status: "simulated",
        verification_level: "unverified",
        message: "Sandbox mode: payload validated, nothing was persisted.",
        links: {
          self: `https://syriasan.com/api/public/v1/addresses/${sample}`,
          address_page: `https://syriasan.com/a/${sample}`,
          qr: `https://syriasan.com/api/public/v1/qr/${sample}`,
        },
      },
      201,
    );
  }

  const { data: node, error: nodeErr } = await admin
    .from("location_nodes")
    .insert({
      node_type: "building",
      display_name: d.name_ar,
      name_ar: d.name_ar,
      name_en: d.name_en ?? null,
      latitude: d.latitude,
      longitude: d.longitude,
      governorate: d.governorate,
      city: d.city ?? null,
      district: d.district ?? null,
      neighborhood: d.neighborhood ?? null,
      street: d.street ?? null,
      landmark: d.landmark ?? null,
      building_number: d.building_number ?? null,
      parking_info: d.parking_info ?? null,
      loading_info: d.loading_info ?? null,
      // The developer API may only create PUBLIC addresses.
      visibility: "public",
      verification_level: "unverified",
      confidence_score: 45,
      created_by: auth.ownerId,
    })
    .select("id")
    .single();
  if (nodeErr) return fail("create_failed", 500, nodeErr.message);

  let accessPointId: string | null = null;
  if (d.entrance_name || d.entrance_instructions) {
    const { data: ap } = await admin
      .from("access_points")
      .insert({
        node_id: node.id,
        access_type: "main_entrance",
        display_name: d.entrance_name || "المدخل الرئيسي",
        name_ar: d.entrance_name || "المدخل الرئيسي",
        latitude: d.latitude,
        longitude: d.longitude,
        instructions_ar: d.entrance_instructions ?? null,
        accessibility: [],
        always_open: true,
        verification_level: "unverified",
        confidence_score: 45,
        created_by: auth.ownerId,
      })
      .select("id")
      .single();
    accessPointId = ap?.id ?? null;
  }

  const { generateSmartCode } = await import("./addresses.server");
  const code = await generateSmartCode(admin, d.governorate_code.toUpperCase());
  const { error: codeErr } = await admin.from("smart_addresses").insert({
    code,
    node_id: node.id,
    default_access_point_id: accessPointId,
    label: d.label ?? d.name_ar,
    is_public: true,
    created_by: auth.ownerId,
  });
  if (codeErr) return fail("create_failed", 500, codeErr.message);

  await audit(admin, auth, "address_created", "smart_address", node.id, { code });

  return json(
    {
      code,
      status: "created",
      verification_level: "unverified",
      links: {
        self: `https://syriasan.com/api/public/v1/addresses/${code}`,
        address_page: `https://syriasan.com/a/${code}`,
        qr: `https://syriasan.com/api/public/v1/qr/${code}`,
      },
    },
    201,
  );
}

async function searchAddresses(url: URL, admin: Admin) {
  const q = (url.searchParams.get("q") ?? "").trim();
  const governorate = url.searchParams.get("governorate");
  const city = url.searchParams.get("city");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);
  if (q.length < 2 && !governorate && !city) {
    return fail("invalid_request", 400, "Provide `q` (min 2 chars), `governorate` or `city`.");
  }

  let query = admin
    .from("smart_addresses")
    .select(
      "code, label, node:location_nodes!inner(display_name, name_en, governorate, city, district, neighborhood, street, landmark, latitude, longitude, visibility, is_active, verification_level)",
    )
    .eq("is_public", true)
    .eq("node.visibility", "public")
    .eq("node.is_active", true)
    .limit(limit);

  if (q) query = query.or(`display_name.ilike.%${q}%,name_en.ilike.%${q}%,street.ilike.%${q}%`, { referencedTable: "node" });
  if (governorate) query = query.ilike("node.governorate", `%${governorate}%`);
  if (city) query = query.ilike("node.city", `%${city}%`);

  const { data, error } = await query;
  if (error) return fail("search_failed", 500, error.message);

  const results = (data ?? [])
    .filter((row) => row.node)
    .filter((row) => {
      if (!q) return true;
      const n = row.node as { display_name?: string | null; name_en?: string | null; street?: string | null };
      const hay = `${n.display_name ?? ""} ${n.name_en ?? ""} ${n.street ?? ""} ${row.code}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    })
    .map((row) => {
      const n = row.node as Record<string, unknown>;
      return {
        code: row.code,
        label: row.label,
        display_name: n["display_name"],
        governorate: n["governorate"],
        city: n["city"],
        district: n["district"],
        neighborhood: n["neighborhood"],
        street: n["street"],
        landmark: n["landmark"],
        latitude: n["latitude"],
        longitude: n["longitude"],
        verification_level: n["verification_level"],
        links: { self: `https://syriasan.com/api/public/v1/addresses/${row.code}` },
      };
    });

  return json({ query: q || null, count: results.length, results });
}

async function validatePayload(body: unknown) {
  const schema = z.object({
    code: z.string().trim().max(32).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    governorate: z.string().max(40).optional(),
    city: z.string().max(60).optional(),
    street: z.string().max(120).optional(),
    building_number: z.string().max(30).optional(),
  });
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return fail("invalid_request", 400, "Validation failed.");
  const d = parsed.data;

  const issues: { field: string; code: string; message: string }[] = [];
  let exists: boolean | null = null;
  let isPublic: boolean | null = null;

  if (d.code) {
    if (!CODE_RE.test(d.code)) {
      issues.push({ field: "code", code: "format", message: "Expected SY-XXX-XXXX." });
    } else {
      const { resolvePublicCode } = await import("./addresses.server");
      const r = await resolvePublicCode(d.code.toUpperCase(), "visitor" as never, {});
      exists = r.status !== "not_found";
      isPublic = r.status === "ok";
      if (!exists) issues.push({ field: "code", code: "not_found", message: "Unknown smart code." });
      if (exists && !isPublic) {
        issues.push({ field: "code", code: "private", message: "Address exists but is private." });
      }
    }
  }

  if (d.latitude !== undefined || d.longitude !== undefined) {
    if (d.latitude === undefined || d.longitude === undefined) {
      issues.push({ field: "coordinates", code: "incomplete", message: "Both latitude and longitude required." });
    } else if (!inSyria(d.latitude, d.longitude)) {
      issues.push({ field: "coordinates", code: "out_of_bounds", message: "Coordinates outside Syria." });
    }
  }

  const filled = [d.governorate, d.city, d.street, d.building_number].filter(Boolean).length;
  const completeness = Math.round(((filled / 4) * 60 + (d.code ? 20 : 0) + (d.latitude !== undefined ? 20 : 0)));

  return json({ valid: issues.length === 0, exists, is_public: isPublic, completeness, issues });
}

async function geocode(body: unknown, admin: Admin) {
  const parsed = z.object({ query: z.string().trim().min(2).max(160), lang: z.enum(["ar", "en"]).default("ar") }).safeParse(body);
  if (!parsed.success) return fail("invalid_request", 400, "`query` is required (2–160 chars).");
  const { query, lang } = parsed.data;

  const { data } = await admin
    .from("location_nodes")
    .select("display_name, governorate, city, street, latitude, longitude")
    .eq("visibility", "public")
    .eq("is_active", true)
    .ilike("display_name", `%${query}%`)
    .not("latitude", "is", null)
    .limit(5);

  const internal = (data ?? []).map((n) => ({
    label: [n.display_name, n.city, n.governorate].filter(Boolean).join("، "),
    latitude: n.latitude,
    longitude: n.longitude,
    kind: "syriasan",
    provider: "syriasan",
  }));

  const { geocodeExternal } = await import("./navigation/providers.server");
  const external = internal.length >= 3 ? [] : await geocodeExternal(query, lang);

  return json({ query, results: [...internal, ...external].slice(0, 8) });
}

async function reverseGeocode(body: unknown, admin: Admin) {
  const parsed = z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      lang: z.enum(["ar", "en"]).default("ar"),
      radius_m: z.number().min(10).max(2000).default(300),
    })
    .safeParse(body);
  if (!parsed.success) return fail("invalid_request", 400, "`latitude` and `longitude` are required.");
  const { latitude, longitude, lang, radius_m } = parsed.data;

  const delta = radius_m / 111_000;
  const { data } = await admin
    .from("smart_addresses")
    .select("code, node:location_nodes!inner(display_name, governorate, city, street, latitude, longitude, visibility, is_active)")
    .eq("is_public", true)
    .eq("node.visibility", "public")
    .eq("node.is_active", true)
    .gte("node.latitude", latitude - delta)
    .lte("node.latitude", latitude + delta)
    .gte("node.longitude", longitude - delta)
    .lte("node.longitude", longitude + delta)
    .limit(20);

  const { haversineMeters } = await import("./addresses.server");
  const nearby = (data ?? [])
    .map((row) => {
      const n = row.node as unknown as {
        display_name: string;
        governorate: string | null;
        city: string | null;
        street: string | null;
        latitude: number;
        longitude: number;
      };
      return {
        code: row.code,
        display_name: n.display_name,
        governorate: n.governorate,
        city: n.city,
        street: n.street,
        latitude: n.latitude,
        longitude: n.longitude,
        distance_m: Math.round(haversineMeters({ lat: latitude, lng: longitude }, { lat: n.latitude, lng: n.longitude })),
      };
    })
    .filter((n) => n.distance_m <= radius_m)
    .sort((a, b) => a.distance_m - b.distance_m)
    .slice(0, 5);

  const { reverseGeocodeExternal } = await import("./navigation/providers.server");
  const place = await reverseGeocodeExternal({ latitude, longitude }, lang);

  return json({ point: { latitude, longitude }, smart_addresses: nearby, place });
}

async function routeTo(url: URL) {
  const from = (url.searchParams.get("from") ?? "").split(",").map(Number);
  const to = url.searchParams.get("to") ?? "";
  const mode = (url.searchParams.get("mode") ?? "driving") as "driving" | "walking" | "cycling";
  if (from.length !== 2 || from.some((n) => !Number.isFinite(n))) {
    return fail("invalid_request", 400, "`from` must be `latitude,longitude`.");
  }
  if (!to) return fail("invalid_request", 400, "`to` must be a smart code or `latitude,longitude`.");

  let destination: { latitude: number; longitude: number };
  let destinationKind = "coordinates";
  let code: string | null = null;

  if (CODE_RE.test(to)) {
    const { resolvePublicCode } = await import("./addresses.server");
    const r = await resolvePublicCode(to.toUpperCase(), "parcel_delivery" as never, {});
    if (r.status === "not_found") return fail("not_found", 404, "Unknown smart code.");
    if (r.status !== "ok") return fail("private", 403, "This address is private.");
    const lat = r.recommended?.latitude ?? r.site.latitude;
    const lng = r.recommended?.longitude ?? r.site.longitude;
    if (lat == null || lng == null) {
      return fail("no_coordinates", 422, "Destination has no coordinates.");
    }
    destination = { latitude: lat, longitude: lng };
    destinationKind = r.recommended ? "entrance" : "site";
    code = r.code;
  } else {
    const pair = to.split(",").map(Number);
    if (pair.length !== 2 || pair.some((n) => !Number.isFinite(n))) {
      return fail("invalid_request", 400, "`to` must be a smart code or `latitude,longitude`.");
    }
    destination = { latitude: pair[0]!, longitude: pair[1]! };
  }

  const origin = { latitude: from[0]!, longitude: from[1]! };
  const { routingProvider, routingConfigured, straightLineRoute } = await import("./navigation/providers.server");
  const { haversineMeters } = await import("./navigation/geo");
  const straight = haversineMeters(origin, destination);

  if (!routingConfigured()) {
    return json({
      degraded: true,
      reason: "routing_not_configured",
      destination_kind: destinationKind,
      code,
      route: straightLineRoute(origin, destination, mode, straight),
    });
  }

  try {
    const route = await routingProvider().calculateRoute(origin, destination, mode);
    return json({ degraded: false, destination_kind: destinationKind, code, route });
  } catch {
    return json({
      degraded: true,
      reason: "routing_service_unavailable",
      destination_kind: destinationKind,
      code,
      route: straightLineRoute(origin, destination, mode, straight),
    });
  }
}

async function qrFor(code: string, url: URL) {
  const target = `https://syriasan.com/a/${code.toUpperCase()}`;
  if ((url.searchParams.get("format") ?? "json") === "svg") {
    const size = Math.min(Math.max(Number(url.searchParams.get("size") ?? 512) || 512, 128), 2048);
    const [{ renderToStaticMarkup }, React, { QRCodeSVG }] = await Promise.all([
      import("react-dom/server"),
      import("react"),
      import("qrcode.react"),
    ]);
    const svg = renderToStaticMarkup(
      React.createElement(QRCodeSVG, { value: target, size, level: "M", includeMargin: true }),
    );
    return new Response(svg, {
      status: 200,
      headers: { ...CORS, "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
    });
  }
  return json({
    code: code.toUpperCase(),
    target,
    svg_url: `https://syriasan.com/api/public/v1/qr/${code.toUpperCase()}?format=svg`,
    delivery_target: `https://syriasan.com/d/${code.toUpperCase()}`,
  });
}

async function revokeOwnKey(body: unknown, admin: Admin, auth: AuthOk) {
  const parsed = z.object({ key_prefix: z.string().trim().min(8).max(32) }).safeParse(body);
  if (!parsed.success) return fail("invalid_request", 400, "`key_prefix` is required.");
  const { data: row } = await admin
    .from("api_keys")
    .select("id")
    .eq("client_id", auth.clientId)
    .eq("key_prefix", parsed.data.key_prefix)
    .maybeSingle();
  if (!row) return fail("not_found", 404, "No key with that prefix on this client.");
  await admin.from("api_keys").update({ revoked: true }).eq("id", row.id);
  await audit(admin, auth, "api_key_revoked", "api_key", row.id, { key_prefix: parsed.data.key_prefix });
  return json({ revoked: true, key_prefix: parsed.data.key_prefix });
}

// ---------------------------------------------------------------- dispatcher

type Handled = { response: Response; scope: ApiScope | "public"; endpoint: string };

export async function handleApiV1(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const url = new URL(request.url);
  const segments = url.pathname.split("/").filter(Boolean);
  const v1 = segments.indexOf("v1");
  const parts = v1 === -1 ? [] : segments.slice(v1 + 1);
  const resource = parts[0] ?? "";
  const param = parts[1] ?? "";
  const started = Date.now();
  const endpoint = `/api/v1/${resource}${param ? `/${param}` : ""}`;

  if (!resource) {
    return json({
      service: "Syriasan Developer API",
      version: "v1",
      docs: "https://syriasan.com/developers",
      endpoints: [
        "POST /api/v1/addresses",
        "GET /api/v1/addresses/{code}",
        "GET /api/v1/resolve/{code}",
        "GET /api/v1/search",
        "POST /api/v1/validate",
        "POST /api/v1/geocode",
        "POST /api/v1/reverse-geocode",
        "GET /api/v1/qr/{code}",
        "GET /api/v1/route",
        "POST /api/v1/keys/revoke",
      ],
      privacy: "Private residential addresses are never exposed through this API.",
    });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as Admin;

  const auth = await authenticate(request, admin);
  if (auth instanceof Response) return auth;

  const body = request.method === "POST" ? await request.json().catch(() => null) : null;

  const need = (scope: ApiScope): Response | null =>
    auth.scopes.includes(scope)
      ? null
      : fail("insufficient_scope", 403, `This API key is missing the \`${scope}\` scope.`);

  let handled: Handled | null = null;

  const run = async (scope: ApiScope, fn: () => Promise<Response>): Promise<Handled> => {
    const denied = need(scope);
    return { response: denied ?? (await fn()), scope, endpoint };
  };

  if (resource === "addresses" && request.method === "POST" && !param) {
    handled = await run("addresses:write", () => createAddress(body, admin, auth));
  } else if (resource === "addresses" && request.method === "GET" && param) {
    handled = await run("addresses:read", async () => {
      const { resolvePublicCode } = await import("./addresses.server");
      const r = await resolvePublicCode(param.toUpperCase(), "visitor" as never, {});
      if (r.status === "not_found") return fail("not_found", 404, "Unknown smart code.");
      if (r.status !== "ok") {
        return fail("private", 403, "This address is private and cannot be disclosed.");
      }
      return json(publicAddressPayload(r));
    });
  } else if (resource === "resolve" && request.method === "GET" && param) {
    handled = await run("resolve", async () => {
      const purpose = url.searchParams.get("purpose") ?? "visitor";
      const { resolvePublicCode } = await import("./addresses.server");
      const r = await resolvePublicCode(param.toUpperCase(), purpose as never, {
        requireWheelchair: url.searchParams.get("wheelchair") === "true",
      });
      if (r.status === "not_found") return fail("not_found", 404, "Unknown smart code.");
      if (r.status !== "ok") {
        return fail("private", 403, "This address is private and cannot be disclosed.");
      }
      return json({ ...publicAddressPayload(r), purpose: r.purpose, prohibited: r.prohibited, notes: r.notes });
    });
  } else if (resource === "search" && request.method === "GET") {
    handled = await run("search", () => searchAddresses(url, admin));
  } else if (resource === "validate" && request.method === "POST") {
    handled = await run("validate", () => validatePayload(body));
  } else if (resource === "geocode" && request.method === "POST") {
    handled = await run("geocode", () => geocode(body, admin));
  } else if (resource === "reverse-geocode" && request.method === "POST") {
    handled = await run("geocode", () => reverseGeocode(body, admin));
  } else if (resource === "qr" && request.method === "GET" && param) {
    handled = await run("qr", async () => {
      if (!CODE_RE.test(param)) return fail("invalid_request", 400, "Malformed smart code.");
      return qrFor(param, url);
    });
  } else if (resource === "route" && request.method === "GET") {
    handled = await run("route", () => routeTo(url));
  } else if (resource === "keys" && param === "revoke" && request.method === "POST") {
    handled = await run("keys:manage", () => revokeOwnKey(body, admin, auth));
  }

  if (!handled) {
    const notFound = fail("unknown_endpoint", 404, `No v1 endpoint for ${request.method} ${endpoint}.`);
    await meter(admin, auth, endpoint, request.method, 404, "none", started);
    return notFound;
  }

  await meter(admin, auth, handled.endpoint, request.method, handled.response.status, handled.scope, started);

  const headers = new Headers(handled.response.headers);
  headers.set("X-RateLimit-Limit", String(auth.limit));
  headers.set("X-RateLimit-Remaining", String(Math.max(auth.limit - auth.used - 1, 0)));
  return new Response(handled.response.body, { status: handled.response.status, headers });
}
