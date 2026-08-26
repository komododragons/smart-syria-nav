import { useEffect, useRef } from "react";

import type { Coordinates } from "@/lib/navigation/types";

export type NavMarkerKind =
  | "origin"
  | "destination"
  | "property"
  | "entrance"
  | "entrance_closed"
  | "road_access"
  | "parking";

export type NavMarker = {
  id: string;
  kind: NavMarkerKind;
  point: Coordinates;
  label: string;
  onClick?: () => void;
};

export const MARKER_STYLE: Record<NavMarkerKind, { color: string; glyph: string; ar: string }> = {
  origin: { color: "#16a34a", glyph: "◉", ar: "نقطة الانطلاق" },
  destination: { color: "#e11d48", glyph: "▲", ar: "وجهة المسار" },
  property: { color: "#0f1b3d", glyph: "■", ar: "موقع العقار" },
  entrance: { color: "#3b6fa0", glyph: "▮", ar: "مدخل بديل" },
  entrance_closed: { color: "#9ca3af", glyph: "✕", ar: "مدخل مغلق / مقيّد" },
  road_access: { color: "#f59e0b", glyph: "◆", ar: "نقطة وصول طرقية" },
  parking: { color: "#7c3aed", glyph: "P", ar: "نقطة وقوف" },
};

type Props = {
  markers: NavMarker[];
  /** Decoded route path as [lat, lng] pairs. */
  path?: [number, number][];
  /** Dashed final walking leg, [lat, lng] pairs. */
  finalLeg?: [number, number][];
  center: Coordinates;
  onPick?: (point: Coordinates) => void;
  className?: string;
};

/**
 * MapLibre GL plate for the navigation workspace. The library and its stylesheet
 * are imported dynamically after hydration so SSR never touches browser globals,
 * and the tile source stays OpenStreetMap (no Google dependency).
 */
export function NavigationMap({ markers, path, finalLeg, center, onPick, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const readyRef = useRef(false);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ default: maplibregl }] = await Promise.all([
        import("maplibre-gl"),
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [center.longitude, center.latitude],
        zoom: 15,
        attributionControl: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
      map.on("click", (event: any) => {
        pickRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      });
      map.on("load", () => {
        for (const id of ["route", "final-leg"]) {
          map.addSource(id, {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
          });
        }
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#1e3a5f", "line-width": 6, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "final-leg-line",
          type: "line",
          source: "final-leg",
          layout: { "line-cap": "round" },
          paint: { "line-color": "#e11d48", "line-width": 4, "line-dasharray": [1.5, 1.5] },
        });
        readyRef.current = true;
        mapRef.current = map;
        map.resize();
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route geometry
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const setLine = (id: string, coords?: [number, number][]) => {
        const source = map.getSource(id);
        if (!source) return;
        source.setData({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: (coords ?? []).map(([lat, lng]) => [lng, lat]),
          },
        });
      };
      setLine("route", path);
      setLine("final-leg", finalLeg);
    };
    if (readyRef.current) apply();
    else map.once("load", apply);
  }, [path, finalLeg]);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const { default: maplibregl } = await import("maplibre-gl");
      if (cancelled || !mapRef.current) return;
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current = markers.map((marker) => {
        const style = MARKER_STYLE[marker.kind];
        const el = document.createElement("button");
        el.type = "button";
        el.title = marker.label;
        el.setAttribute("aria-label", marker.label);
        el.style.cssText = `display:grid;place-items:center;width:26px;height:26px;border-radius:9999px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);font-size:12px;font-weight:700;color:#fff;cursor:${marker.onClick ? "pointer" : "default"};background:${style.color}`;
        el.textContent = style.glyph;
        if (marker.onClick) el.addEventListener("click", (e) => { e.stopPropagation(); marker.onClick?.(); });
        return new maplibregl.Marker({ element: el })
          .setLngLat([marker.point.longitude, marker.point.latitude])
          .addTo(map);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [markers]);

  // Fit to content
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: [number, number][] = [
      ...markers.map((m) => [m.point.longitude, m.point.latitude] as [number, number]),
      ...(path ?? []).map(([lat, lng]) => [lng, lat] as [number, number]),
    ];
    if (points.length === 0) return;
    const fit = () => {
      if (points.length === 1) {
        map.easeTo({ center: points[0], zoom: 16 });
        return;
      }
      const lons = points.map((p) => p[0]);
      const lats = points.map((p) => p[1]);
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: 70, maxZoom: 17, duration: 600 },
      );
    };
    if (readyRef.current) fit();
    else map.once("load", fit);
  }, [markers, path]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}

export function NavigationLegend({ kinds }: { kinds: NavMarkerKind[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {kinds.map((kind) => (
        <span key={kind} className="inline-flex items-center gap-1">
          <span
            className="inline-grid size-3.5 place-items-center rounded-full text-[8px] font-bold text-white"
            style={{ background: MARKER_STYLE[kind].color }}
          >
            {MARKER_STYLE[kind].glyph}
          </span>
          {MARKER_STYLE[kind].ar}
        </span>
      ))}
    </div>
  );
}
