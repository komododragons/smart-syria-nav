/**
 * Client-safe geometry helpers: polyline codec, distance, bearing, formatting.
 * Shared by the map, the turn-by-turn engine and the server routing services.
 */
import type { Coordinates, Lang } from "./types";

/** Decode a Google/OSRM encoded polyline into [lng, lat] pairs. */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision;
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

/** Encode [lng, lat] pairs into an encoded polyline (precision 5). */
export function encodePolyline(coords: [number, number][], precision = 5): string {
  const factor = 10 ** precision;
  let out = "";
  let prevLat = 0;
  let prevLng = 0;
  for (const [lng, lat] of coords) {
    const iLat = Math.round(lat * factor);
    const iLng = Math.round(lng * factor);
    out += encodeSigned(iLat - prevLat) + encodeSigned(iLng - prevLng);
    prevLat = iLat;
    prevLng = iLng;
  }
  return out;
}

function encodeSigned(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

export function haversineMeters(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(a: Coordinates, b: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

export function formatDistance(meters: number, lang: Lang = "ar"): string {
  if (!Number.isFinite(meters)) return lang === "ar" ? "—" : "—";
  if (meters < 950) {
    const v = Math.round(meters / 10) * 10;
    return lang === "ar" ? `${v} م` : `${v} m`;
  }
  const km = meters / 1000;
  const v = km < 10 ? km.toFixed(1) : Math.round(km).toString();
  return lang === "ar" ? `${v} كم` : `${v} km`;
}

export function formatDuration(seconds: number, lang: Lang = "ar"): string {
  if (!Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (lang === "ar") {
    if (h && m) return `${h} س ${m} د`;
    if (h) return `${h} س`;
    return `${m} د`;
  }
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

/** Bounding box of a coordinate list, as [west, south, east, north]. */
export function boundsOf(points: Coordinates[]): [number, number, number, number] | null {
  if (!points.length) return null;
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  for (const p of points) {
    w = Math.min(w, p.longitude);
    e = Math.max(e, p.longitude);
    s = Math.min(s, p.latitude);
    n = Math.max(n, p.latitude);
  }
  return [w, s, e, n];
}

/**
 * Shortest distance in metres from a point to a polyline, using a local
 * equirectangular projection. Used for off-route detection while navigating.
 */
export function distanceToPath(point: Coordinates, path: [number, number][]): number {
  const first = path[0];
  if (!first) return Number.POSITIVE_INFINITY;
  if (path.length === 1) {
    return haversineMeters(point, { longitude: first[0], latitude: first[1] });
  }
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((point.latitude * Math.PI) / 180);
  const px = point.longitude * mPerLng;
  const py = point.latitude * mPerLat;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const ax = a[0] * mPerLng;
    const ay = a[1] * mPerLat;
    const bx = b[0] * mPerLng;
    const by = b[1] * mPerLat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    best = Math.min(best, Math.hypot(px - cx, py - cy));
  }
  return best;
}

/** Reasonable sanity bound between a property and one of its entrances. */
export const MAX_ENTRANCE_OFFSET_M = 250;

export function isWithinPropertyRadius(
  property: Coordinates,
  point: Coordinates,
  maxMeters = MAX_ENTRANCE_OFFSET_M,
): boolean {
  return haversineMeters(property, point) <= maxMeters;
}
