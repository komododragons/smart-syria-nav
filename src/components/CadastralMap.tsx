import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, LocateFixed } from "lucide-react";

export type MapPin = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  label: string;
  tone: "site" | "recommended" | "alternative" | "prohibited" | "draft";
  /** Smart code, when the pin resolves to one. Makes the pin selectable. */
  code?: string | null;
};

type Props = {
  center: { latitude: number; longitude: number };
  pins: MapPin[];
  spanMeters?: number;
  fill?: boolean;
  onPick?: (coords: { latitude: number; longitude: number }) => void;
  onSelectPin?: (pin: MapPin) => void;
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
 * Provider-neutral civic map plate. Renders OpenStreetMap tiles with building and
 * access-point pins projected around a centre point; no map SDK is coupled to
 * the data model. In `fill` mode it stretches to its parent's height for the
 * map-dominant split-screen home.
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
  const groundRes = 156543.03392 * Math.cos((center.latitude * Math.PI) / 180);
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

const MIN_SPAN = 60;
const MAX_SPAN = 900_000; // كامل سوريا وأكثر

export function CadastralMap({
  center,
  pins,
  spanMeters = 420,
  fill = false,
  onPick,
  onLocate,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState({ ...center, span: spanMeters });
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    setView({ ...center, span: spanMeters });
  }, [center.latitude, center.longitude, spanMeters]);

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

  const viewCenter = useMemo(
    () => ({ latitude: view.latitude, longitude: view.longitude }),
    [view.latitude, view.longitude],
  );

  const tiles = useMemo(
    () => buildTiles(viewCenter, view.span, size.width, size.height),
    [viewCenter, view.span, size.width, size.height],
  );

  /** Zoom around a pixel anchor inside the plate (defaults to centre). */
  const zoomBy = (factor: number, anchor?: { x: number; y: number }) => {
    const el = ref.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    setView((v) => {
      const next = Math.min(MAX_SPAN, Math.max(MIN_SPAN, v.span * factor));
      if (next === v.span) return v;
      const ax = anchor ? anchor.x : w / 2;
      const ay = anchor ? anchor.y : h / 2;
      const mLat = 111_320;
      const mLng = 111_320 * Math.cos((v.latitude * Math.PI) / 180);
      const fx = ax / w - 0.5;
      const fy = ay / h - 0.5;
      const spanYOld = (v.span * h) / w;
      const spanYNew = (next * h) / w;
      const dLng = (fx * v.span) / mLng - (fx * next) / mLng;
      const dLat = -(fy * spanYOld) / mLat - (-(fy * spanYNew) / mLat);
      return {
        latitude: v.latitude + dLat,
        longitude: v.longitude + dLng,
        span: next,
      };
    });
  };

  const zoomRef = useRef(zoomBy);
  zoomRef.current = zoomBy;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const rect = el.getBoundingClientRect();
      zoomRef.current(Math.exp(dy * 0.0015), {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const project = useMemo(() => {
    const metersPerLat = 111_320;
    const metersPerLng = 111_320 * Math.cos((view.latitude * Math.PI) / 180);
    return (lat: number, lng: number) => {
      const dx = (lng - view.longitude) * metersPerLng;
      const dy = (lat - view.latitude) * metersPerLat;
      const el = ref.current;
      const ratio = el && el.clientHeight ? el.clientWidth / el.clientHeight : 4 / 3;
      return {
        left: 50 + (dx / view.span) * 100,
        top: 50 - ((dy / view.span) * 100) * ratio,
      };
    };
  }, [view.latitude, view.longitude, view.span]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = ref.current;
    if (!drag || !el || event.buttons === 0) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    setView((v) => {
      const mLat = 111_320;
      const mLng = 111_320 * Math.cos((v.latitude * Math.PI) / 180);
      const spanY = (v.span * h) / w;
      return {
        ...v,
        longitude: v.longitude - ((dx / w) * v.span) / mLng,
        latitude: v.latitude + ((dy / h) * spanY) / mLat,
      };
    });
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) return;
    if (!onPick || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const metersPerLat = 111_320;
    const metersPerLng = 111_320 * Math.cos((view.latitude * Math.PI) / 180);
    const spanY = (view.span * rect.height) / rect.width;
    onPick({
      latitude: view.latitude - ((py - 0.5) * spanY) / metersPerLat,
      longitude: view.longitude + ((px - 0.5) * view.span) / metersPerLng,
    });
  }

  const plateClass = fill
    ? `cadastral-grid relative h-full w-full overflow-hidden ${onPick ? "cursor-crosshair" : "cursor-grab"}`
    : `cadastral-grid relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border ${onPick ? "cursor-crosshair" : "cursor-grab"}`;

  return (
    <div className={className}>
      <div
        ref={ref}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        role={onPick ? "button" : undefined}
        tabIndex={onPick ? 0 : undefined}
        aria-label={onPick ? "اختر موقعاً على الخريطة" : "خريطة المواقع"}
        style={{ touchAction: "none" }}
        className={plateClass}
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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent" />

        {/* Civic coordinate HUD */}
        <div className="pointer-events-none absolute bottom-3 start-3 flex items-center gap-3 rounded-lg border border-border bg-foreground/85 px-3 py-1.5 font-mono text-[10px] tracking-wider text-background backdrop-blur-md">
          <span>
            <span className="font-bold text-primary">LAT</span> {view.latitude.toFixed(4)}°N
          </span>
          <span className="h-3 w-px bg-background/25" />
          <span>
            <span className="font-bold text-primary">LON</span> {view.longitude.toFixed(4)}°E
          </span>
          <span className="h-3 w-px bg-background/25" />
          <span>
            {view.span >= 1000 ? `${Math.round(view.span / 1000)} km` : `${Math.round(view.span)} m`}
          </span>
        </div>
        <span className="pointer-events-none absolute bottom-3 end-3 rounded bg-surface/80 px-1 font-mono text-[8px] text-muted-foreground">
          © OpenStreetMap
        </span>

        <div className="absolute top-3 start-1/2 flex -translate-x-1/2 gap-1">
          <button
            type="button"
            aria-label="تصغير"
            onClick={(e) => {
              e.stopPropagation();
              zoomBy(2);
            }}
            className="grid size-9 place-items-center rounded-full border border-border bg-surface/95 text-base font-bold text-foreground shadow-plate"
          >
            −
          </button>
          <button
            type="button"
            aria-label="تكبير"
            onClick={(e) => {
              e.stopPropagation();
              zoomBy(0.5);
            }}
            className="grid size-9 place-items-center rounded-full border border-border bg-surface/95 text-base font-bold text-foreground shadow-plate"
          >
            +
          </button>
          <button
            type="button"
            aria-label="كل سوريا"
            onClick={(e) => {
              e.stopPropagation();
              setView({ latitude: 34.8, longitude: 38.5, span: 700_000 });
            }}
            className="grid h-9 place-items-center rounded-full border border-border bg-surface/95 px-3 text-[11px] font-bold text-foreground shadow-plate"
          >
            سوريا
          </button>
          <button
            type="button"
            aria-label="إعادة الضبط"
            onClick={(e) => {
              e.stopPropagation();
              setView({ ...center, span: spanMeters });
            }}
            className="grid h-9 place-items-center rounded-full border border-border bg-surface/95 px-3 text-[11px] font-bold text-foreground shadow-plate"
          >
            ⤾
          </button>
        </div>

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
          <div className="pointer-events-none absolute top-3 end-3 flex items-center gap-1 rounded-lg border border-border bg-surface/90 px-2 py-1 text-[10px] font-medium">
            <Crosshair className="size-3 text-primary" />
            انقر لتحديد الموقع
          </div>
        ) : null}
      </div>

      {!fill ? (
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
      ) : null}
    </div>
  );
}
