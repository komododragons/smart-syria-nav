import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, LocateFixed } from "lucide-react";

export type MapPin = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  label: string;
  tone: "site" | "recommended" | "alternative" | "prohibited" | "draft";
};

type Props = {
  center: { latitude: number; longitude: number };
  pins: MapPin[];
  spanMeters?: number;
  onPick?: (coords: { latitude: number; longitude: number }) => void;
  onLocate?: () => void;
  className?: string;
};

const TONE_CLASS: Record<MapPin["tone"], string> = {
  site: "bg-foreground",
  recommended: "bg-primary",
  alternative: "bg-muted-foreground",
  prohibited: "bg-prohibit",
  draft: "bg-primary",
};

/**
 * Provider-neutral cadastral plate. Renders a survey grid with building and
 * access-point pins projected around a centre point; no map SDK is coupled to
 * the data model, so tiles/satellite can be layered later.
 */
type Tile = { key: string; url: string; left: number; top: number; size: number };

/** Web-mercator tile layout for the current centre/span, sized to the plate in px. */
function buildTiles(
  center: { latitude: number; longitude: number },
  spanMeters: number,
  width: number,
  height: number,
): Tile[] {
  if (!width || !height) return [];
  const metersPerPixel = spanMeters / width;
  const groundRes = (156543.03392 * Math.cos((center.latitude * Math.PI) / 180)) / 1;
  let zoom = Math.round(Math.log2(groundRes / metersPerPixel));
  zoom = Math.min(19, Math.max(2, zoom));
  const scale = 2 ** zoom;
  const tileSize = 256 * (groundRes / scale / metersPerPixel);

  const xCenter = ((center.longitude + 180) / 360) * scale;
  const latRad = (center.latitude * Math.PI) / 180;
  const yCenter =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;

  const tiles: Tile[] = [];
  const xFrom = Math.floor(xCenter - width / 2 / tileSize);
  const xTo = Math.floor(xCenter + width / 2 / tileSize);
  const yFrom = Math.floor(yCenter - height / 2 / tileSize);
  const yTo = Math.floor(yCenter + height / 2 / tileSize);

  for (let x = xFrom; x <= xTo; x++) {
    for (let y = yFrom; y <= yTo; y++) {
      if (y < 0 || y >= scale) continue;
      const wrappedX = ((x % scale) + scale) % scale;
      tiles.push({
        key: `${zoom}/${x}/${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: (x - xCenter) * tileSize + width / 2,
        top: (y - yCenter) * tileSize + height / 2,
        size: tileSize,
      });
    }
  }
  return tiles;
}

export function CadastralMap({ center, pins, spanMeters = 420, onPick, onLocate, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => observer.disconnect();
  }, []);

  const tiles = useMemo(
    () => buildTiles(center, spanMeters, size.width, size.height),
    [center.latitude, center.longitude, spanMeters, size.width, size.height],
  );


  const project = useMemo(() => {
    const metersPerLat = 111_320;
    const metersPerLng = 111_320 * Math.cos((center.latitude * Math.PI) / 180);
    return (lat: number, lng: number) => {
      const dx = (lng - center.longitude) * metersPerLng;
      const dy = (lat - center.latitude) * metersPerLat;
      return {
        left: 50 + (dx / spanMeters) * 100,
        top: 50 - (dy / spanMeters) * 100,
      };
    };
  }, [center.latitude, center.longitude, spanMeters]);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!onPick || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const metersPerLat = 111_320;
    const metersPerLng = 111_320 * Math.cos((center.latitude * Math.PI) / 180);
    onPick({
      latitude: center.latitude - ((py - 0.5) * spanMeters) / metersPerLat,
      longitude: center.longitude + ((px - 0.5) * spanMeters) / metersPerLng,
    });
  }

  return (
    <div className={className}>
      <div
        ref={ref}
        onClick={handleClick}
        role={onPick ? "button" : undefined}
        tabIndex={onPick ? 0 : undefined}
        aria-label={onPick ? "اختر موقعاً على الخريطة" : "خريطة المواقع"}
        className={`cadastral-grid relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border ${onPick ? "cursor-crosshair" : ""}`}
      >
        <div className="pointer-events-none absolute inset-0 opacity-90">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              loading="lazy"
              draggable={false}
              className="absolute select-none"
              style={{ left: tile.left, top: tile.top, width: tile.size, height: tile.size }}
            />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/50 via-transparent to-transparent" />
        <span className="pointer-events-none absolute bottom-1 end-1 rounded bg-surface/80 px-1 font-mono text-[8px] text-muted-foreground">
          © OpenStreetMap
        </span>
        <span className="pointer-events-none absolute top-3 start-3 font-mono text-[10px] tracking-widest text-muted-foreground">
          {center.latitude.toFixed(4)}°N
        </span>
        <span className="pointer-events-none absolute bottom-3 start-3 font-mono text-[10px] tracking-widest text-muted-foreground">
          {center.longitude.toFixed(4)}°E
        </span>
        <span className="pointer-events-none absolute top-3 end-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {spanMeters} m
        </span>

        {pins
          .filter((p) => p.latitude != null && p.longitude != null)
          .map((pin) => {
            const { left, top } = project(pin.latitude as number, pin.longitude as number);
            const clampedLeft = Math.min(96, Math.max(4, left));
            const clampedTop = Math.min(94, Math.max(6, top));
            return (
              <div
                key={pin.id}
                className="animate-entrance absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${clampedLeft}%`, top: `${clampedTop}%` }}
                onMouseEnter={() => setHover(pin.id)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={`grid size-5 place-items-center rounded-full ring-2 ring-surface ${TONE_CLASS[pin.tone]} ${pin.tone === "recommended" ? "shadow-plate" : ""}`}
                >
                  <span className="size-1.5 rounded-full bg-surface" />
                </div>
                <span
                  className={`mt-1 block whitespace-nowrap rounded-sm bg-surface/90 px-1.5 text-[10px] font-medium ${hover === pin.id ? "opacity-100" : "opacity-80"}`}
                >
                  {pin.label}
                </span>
              </div>
            );
          })}

        {onPick ? (
          <div className="pointer-events-none absolute bottom-3 end-3 flex items-center gap-1 rounded-lg border border-border bg-surface/90 px-2 py-1 text-[10px] font-medium">
            <Crosshair className="size-3 text-primary" />
            انقر لتحديد الموقع
          </div>
        ) : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" />
            نقطة الوصول الموصى بها
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-foreground" />
            المبنى / الموقع
          </span>
        </div>
        {onLocate ? (
          <button
            type="button"
            onClick={onLocate}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 font-medium text-foreground"
          >
            <LocateFixed className="size-3.5 text-primary" />
            موقعي الحالي
          </button>
        ) : null}
      </div>
    </div>
  );
}
