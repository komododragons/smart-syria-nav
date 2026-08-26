/**
 * RoutingProviderService / GeocodingService / RouteOptimizationService.
 *
 * Server-only. Every external provider sits behind the interfaces in this
 * file, so openrouteservice, Nominatim and VROOM can each be replaced by a
 * self-hosted OSRM / Valhalla / GraphHopper deployment by adding another
 * implementation here — no UI change required.
 *
 * Provider credentials are read inside the call, never at module scope, and
 * are never returned to the browser.
 */
import { encodePolyline } from "./geo";
import { manoeuvreFromOrs } from "./manoeuvres";
import type {
  Coordinates,
  NavErrorCode,
  RouteBundle,
  RouteResult,
  RouteStep,
  TravelMode,
} from "./types";

export class NavigationError extends Error {
  code: NavErrorCode;
  constructor(code: NavErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "NavigationError";
  }
}

export type OptimizeStopInput = {
  /** Anonymous identifier — never a recipient name or apartment number. */
  ref: string;
  location: Coordinates;
  service_time_s?: number;
  priority?: number;
  window_start_s?: number;
  window_end_s?: number;
};

export type OptimizeResult = {
  order: { ref: string; arrival_s: number }[];
  unassigned: string[];
  total_distance_m: number;
  total_duration_s: number;
  provider: string;
};

export type GeocodeHit = {
  label: string;
  latitude: number;
  longitude: number;
  kind: string;
  provider: string;
};

/** Provider-neutral contract. Implementations must not leak provider types. */
export interface RoutingProvider {
  readonly id: string;
  readonly attribution: string;
  calculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    mode: TravelMode,
  ): Promise<RouteResult>;
  calculateAlternatives(
    origin: Coordinates,
    destination: Coordinates,
    mode: TravelMode,
  ): Promise<RouteBundle>;
  getRouteSteps(route: RouteResult): RouteStep[];
  snapAccessPoint(point: Coordinates, mode: TravelMode): Promise<Coordinates | null>;
  optimizeStops(
    start: Coordinates,
    end: Coordinates | null,
    stops: OptimizeStopInput[],
    mode: TravelMode,
  ): Promise<OptimizeResult>;
  checkServiceHealth(): Promise<{ healthy: boolean; latency_ms: number; status_code: number | null; message: string | null }>;
}

/**
 * HeiGIT unified API. api.openrouteservice.org was shut off on 2026-08-24 in
 * favour of api.heigit.org — the path now carries the service name as a prefix.
 *   directions  -> /openrouteservice/v2/directions
 *   snap        -> /openrouteservice/v2/snap
 *   optimization-> /vroom/v0
 *   health      -> /openrouteservice/v2/health
 * The same HeiGIT API key authorises all services.
 */
const HEIGIT_BASE = "https://api.heigit.org";

const ORS_PROFILE: Record<TravelMode, string> = {
  driving: "driving-car",
  walking: "foot-walking",
  cycling: "cycling-regular",
  delivery: "driving-car",
  heavy: "driving-hgv",
};

async function orsFetch(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  const key = process.env["OPENROUTESERVICE_API_KEY"];
  if (!key) throw new NavigationError("routing_not_configured");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000);
  try {
    return await fetch(`${ORS_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
        Accept: "application/json, application/geo+json",
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof NavigationError) throw err;
    throw new NavigationError("routing_service_unavailable", String(err));
  } finally {
    clearTimeout(timer);
  }
}

type OrsSegmentStep = {
  distance: number;
  duration: number;
  type: number;
  name?: string;
  exit_number?: number;
  way_points?: number[];
};

function orsRouteToResult(
  route: {
    geometry: string;
    summary?: { distance?: number; duration?: number };
    segments?: { steps?: OrsSegmentStep[] }[];
  },
  mode: TravelMode,
  isAlternative: boolean,
): RouteResult {
  const steps: RouteStep[] = [];
  let idx = 0;
  for (const seg of route.segments ?? []) {
    for (const s of seg.steps ?? []) {
      steps.push({
        index: idx++,
        manoeuvre: manoeuvreFromOrs(s.type),
        road_name: s.name && s.name !== "-" ? s.name : null,
        distance_m: Math.round(s.distance ?? 0),
        duration_s: Math.round(s.duration ?? 0),
        exit_number: s.exit_number ?? null,
        way_points:
          s.way_points && s.way_points.length === 2
            ? [s.way_points[0]!, s.way_points[1]!]
            : null,
      });
    }
  }
  return {
    geometry: route.geometry,
    distance_m: Math.round(route.summary?.distance ?? 0),
    duration_s: Math.round(route.summary?.duration ?? 0),
    steps,
    warnings: [],
    provider: "openrouteservice",
    provider_attribution: "© openrouteservice · © OpenStreetMap contributors",
    generated_at: new Date().toISOString(),
    travel_mode: mode,
    is_alternative: isAlternative,
  };
}

export const openRouteServiceProvider: RoutingProvider = {
  id: "openrouteservice",
  attribution: "© openrouteservice · © OpenStreetMap contributors",

  async calculateRoute(origin, destination, mode) {
    const bundle = await this.calculateAlternatives(origin, destination, mode);
    return bundle.primary;
  },

  async calculateAlternatives(origin, destination, mode) {
    const body: Record<string, unknown> = {
      coordinates: [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
      ],
      instructions: true,
      geometry: true,
      units: "m",
      // Provider language is irrelevant: instructions are rendered locally.
      language: "en",
    };
    if (mode !== "walking") {
      body["alternative_routes"] = { target_count: 2, share_factor: 0.6, weight_factor: 1.6 };
    }

    const res = await orsFetch(`/v2/directions/${ORS_PROFILE[mode]}`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (res.status === 429) throw new NavigationError("rate_limited");
    if (!res.ok) {
      const text = await res.text();
      console.error(`[ors] directions failed [${res.status}]: ${text}`);
      if (res.status === 404) throw new NavigationError("no_route_found");
      throw new NavigationError("routing_service_unavailable", `${res.status}`);
    }

    const json = (await res.json()) as {
      routes?: {
        geometry: string;
        summary?: { distance?: number; duration?: number };
        segments?: { steps?: OrsSegmentStep[] }[];
      }[];
    };
    const routes = json.routes ?? [];
    const first = routes[0];
    if (!first) throw new NavigationError("no_route_found");

    return {
      primary: orsRouteToResult(first, mode, false),
      alternatives: routes.slice(1, 3).map((r) => orsRouteToResult(r, mode, true)),
    };
  },

  getRouteSteps(route) {
    return route.steps;
  },

  async snapAccessPoint(point, mode) {
    const res = await orsFetch(`/v2/snap/${ORS_PROFILE[mode]}/json`, {
      method: "POST",
      body: JSON.stringify({ locations: [[point.longitude, point.latitude]], radius: 350 }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { locations?: ({ location?: number[] } | null)[] };
    const loc = json.locations?.[0]?.location;
    if (!loc || loc.length < 2) return null;
    return { longitude: loc[0]!, latitude: loc[1]! };
  },

  async optimizeStops(start, end, stops, mode) {
    // VROOM-compatible payload. openrouteservice hosts a VROOM endpoint at
    // /optimization; a self-hosted VROOM accepts the identical body.
    const vehicle: Record<string, unknown> = {
      id: 1,
      profile: ORS_PROFILE[mode],
      start: [start.longitude, start.latitude],
    };
    if (end) vehicle["end"] = [end.longitude, end.latitude];

    const jobs = stops.map((s, i) => {
      const job: Record<string, unknown> = {
        id: i + 1,
        location: [s.location.longitude, s.location.latitude],
        service: s.service_time_s ?? 180,
      };
      if (s.priority) job["priority"] = Math.max(0, Math.min(100, s.priority));
      if (s.window_start_s != null && s.window_end_s != null) {
        job["time_windows"] = [[s.window_start_s, s.window_end_s]];
      }
      return job;
    });

    const res = await orsFetch("/optimization", {
      method: "POST",
      timeoutMs: 25_000,
      body: JSON.stringify({ jobs, vehicles: [vehicle] }),
    });
    if (res.status === 429) throw new NavigationError("rate_limited");
    if (!res.ok) {
      const text = await res.text();
      console.error(`[vroom] optimization failed [${res.status}]: ${text}`);
      throw new NavigationError("routing_service_unavailable", `${res.status}`);
    }

    const json = (await res.json()) as {
      routes?: { steps?: { type: string; job?: number; arrival?: number }[]; distance?: number; duration?: number }[];
      unassigned?: { id: number }[];
      summary?: { distance?: number; duration?: number };
    };

    const order: { ref: string; arrival_s: number }[] = [];
    for (const step of json.routes?.[0]?.steps ?? []) {
      if (step.type !== "job" || step.job == null) continue;
      const stop = stops[step.job - 1];
      if (stop) order.push({ ref: stop.ref, arrival_s: Math.round(step.arrival ?? 0) });
    }

    return {
      order,
      unassigned: (json.unassigned ?? [])
        .map((u) => stops[u.id - 1]?.ref)
        .filter((r): r is string => Boolean(r)),
      total_distance_m: Math.round(json.summary?.distance ?? json.routes?.[0]?.distance ?? 0),
      total_duration_s: Math.round(json.summary?.duration ?? json.routes?.[0]?.duration ?? 0),
      provider: "vroom@openrouteservice",
    };
  },

  async checkServiceHealth() {
    const started = Date.now();
    try {
      const res = await orsFetch("/v2/health", { method: "GET", timeoutMs: 6000 });
      return {
        healthy: res.ok,
        latency_ms: Date.now() - started,
        status_code: res.status,
        message: res.ok ? null : `HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        healthy: false,
        latency_ms: Date.now() - started,
        status_code: null,
        message: err instanceof NavigationError ? err.code : String(err),
      };
    }
  },
};

/** Resolve the active provider. Swap here to move to OSRM/Valhalla later. */
export function routingProvider(): RoutingProvider {
  return openRouteServiceProvider;
}

export function routingConfigured(): boolean {
  return Boolean(process.env["OPENROUTESERVICE_API_KEY"]);
}

// ---------------- GeocodingService (Nominatim / OSM) ----------------

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/**
 * Used only when a query cannot be answered from our own address database.
 * Bounded to Syria and rate-limited by the caller.
 */
export async function geocodeExternal(query: string, lang: string): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "sy");
  url.searchParams.set("limit", "6");
  url.searchParams.set("accept-language", lang === "en" ? "en" : "ar");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "SyrianSmartAddressNetwork/1.0 (navigation)" },
    });
    if (!res.ok) {
      console.error(`[nominatim] search failed [${res.status}]`);
      return [];
    }
    const rows = (await res.json()) as { display_name: string; lat: string; lon: string; type?: string }[];
    return rows.map((r) => ({
      label: r.display_name,
      latitude: Number(r.lat),
      longitude: Number(r.lon),
      kind: r.type ?? "place",
      provider: "nominatim",
    }));
  } catch (err) {
    console.error("[nominatim] unreachable", err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function reverseGeocodeExternal(
  point: Coordinates,
  lang: string,
): Promise<GeocodeHit | null> {
  const url = new URL(`${NOMINATIM_BASE}/reverse`);
  url.searchParams.set("lat", String(point.latitude));
  url.searchParams.set("lon", String(point.longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", lang === "en" ? "en" : "ar");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "SyrianSmartAddressNetwork/1.0 (navigation)" },
    });
    if (!res.ok) return null;
    const r = (await res.json()) as { display_name?: string; type?: string };
    if (!r.display_name) return null;
    return {
      label: r.display_name,
      latitude: point.latitude,
      longitude: point.longitude,
      kind: r.type ?? "place",
      provider: "nominatim",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Straight-line fallback so the UI can still show a destination, distance and
 * the last-metre card when no routing provider is reachable. Always flagged
 * `approximate_route` — never presented as a real road route.
 */
export function straightLineRoute(
  origin: Coordinates,
  destination: Coordinates,
  mode: TravelMode,
  distanceMeters: number,
): RouteResult {
  const speed = mode === "walking" ? 1.35 : mode === "cycling" ? 4.2 : 8.5;
  return {
    geometry: encodePolyline([
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ]),
    distance_m: Math.round(distanceMeters),
    duration_s: Math.round(distanceMeters / speed),
    steps: [],
    warnings: ["approximate_route"],
    provider: "straight_line",
    provider_attribution: "تقدير بخط مستقيم — بدون بيانات طرق",
    generated_at: new Date().toISOString(),
    travel_mode: mode,
    is_alternative: false,
  };
}
