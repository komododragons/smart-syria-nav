import { useMemo, useRef, useState } from "react";
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
export function CadastralMap({ center, pins, spanMeters = 420, onPick, onLocate, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);

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
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
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
