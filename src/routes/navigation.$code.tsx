import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bike,
  Bookmark,
  Car,
  Crosshair,
  Flag,
  Footprints,
  Link2,
  Locate,
  MapPin,
  Navigation2,
  Play,
  Search,
  Share2,
  Truck,
  X,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/lib/i18n";
import { NavigationLegend, NavigationMap, type NavMarker } from "@/components/NavigationMap";
import { supabase } from "@/integrations/supabase/client";
import { listMyAddresses, searchNetwork } from "@/lib/addresses.functions";
import {
  calculateRoute,
  createRouteShare,
  getNavigationTarget,
  getNavigationTargetAuthed,
  reportRouteProblem,
} from "@/lib/navigation/navigation.functions";
import {
  decodePolyline,
  distanceToPath,
  formatDistance,
  formatDuration,
  haversineMeters,
} from "@/lib/navigation/geo";
import { instructionWithDistance } from "@/lib/navigation/manoeuvres";
import {
  DESTINATION_KIND_LABELS,
  ENTRANCE_KIND_LABELS,
  NAV_ERROR_LABELS,
  ROUTE_REPORT_CATEGORIES,
  TRAVEL_MODES,
  WARNING_LABELS,
  type Coordinates,
  type OriginMethod,
  type RouteBundle,
  type TravelMode,
} from "@/lib/navigation/types";
import {
  ROUTING_CONTEXTS,
  routingContext,
  routingContextLabel,
  routingContextHint,
  type RoutingContext,
} from "@/lib/routing-contexts";

export const Route = createFileRoute("/navigation/$code")({
  validateSearch: (search: Record<string, unknown>) => ({
    ctx: ROUTING_CONTEXTS.some((c) => c.value === search["ctx"])
      ? (search["ctx"] as RoutingContext)
      : undefined,
    token: typeof search["token"] === "string" ? (search["token"] as string) : undefined,
    mode: TRAVEL_MODES.some((m) => m.value === search["mode"])
      ? (search["mode"] as TravelMode)
      : undefined,
  }),
  head: () => ({
    meta: [
      { title: "الاتجاهات إلى عنوان ذكي | الشبكة السورية" },
      {
        name: "description",
        content:
          "مسار طرقي حتى المدخل الصحيح لا مركز المبنى: نقطة وصول طرقية، مدخل التوصيل، الطابق والشقة وتعليمات الأمتار الأخيرة.",
      },
      { property: "og:title", content: "الاتجاهات إلى العنوان الذكي" },
      {
        property: "og:description",
        content: "توجيه دقيق حتى المدخل الصحيح مع تعليمات الوصول الأخيرة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NavigationWorkspace,
});

const MODE_ICON: Record<TravelMode, typeof Car> = {
  driving: Car,
  walking: Footprints,
  cycling: Bike,
  delivery: Truck,
  heavy: Truck,
};

const RECENTS_KEY = "ssan.nav.recents";
type RecentOrigin = { label: string; point: Coordinates };

function readRecents(): RecentOrigin[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? "[]") as RecentOrigin[];
  } catch {
    return [];
  }
}

function pushRecent(entry: RecentOrigin) {
  if (typeof window === "undefined") return;
  const next = [entry, ...readRecents().filter((r) => r.label !== entry.label)].slice(0, 6);
  window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}

function NavigationWorkspace() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const [mode, setMode] = useState<TravelMode>(search.mode ?? "driving");
  const [context, setContext] = useState<RoutingContext>(search.ctx ?? "standard");
  const [entranceId, setEntranceId] = useState<string | null>(null);
  const [wheelchair, setWheelchair] = useState(false);
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const [originMethod, setOriginMethod] = useState<OriginMethod>("current_location");
  const [locationDenied, setLocationDenied] = useState(false);
  const [pickOnMap, setPickOnMap] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [livePoint, setLivePoint] = useState<Coordinates | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [recents, setRecents] = useState<RecentOrigin[]>([]);
  useEffect(() => setRecents(readRecents()), []);

  const publicTarget = useServerFn(getNavigationTarget);
  const authedTarget = useServerFn(getNavigationTargetAuthed);
  const routeFn = useServerFn(calculateRoute);
  const shareFn = useServerFn(createRouteShare);
  const reportFn = useServerFn(reportRouteProblem);
  const searchFn = useServerFn(searchNetwork);
  const myAddressesFn = useServerFn(listMyAddresses);

  const targetQuery = useQuery({
    queryKey: ["nav-target", code, mode, entranceId, wheelchair, context, signedIn, search.token ?? null],
    queryFn: async () =>
      signedIn
        ? await authedTarget({ data: { code, mode, entranceId, wheelchair, context, lang: "ar" } })
        : await publicTarget({
            data: {
              code,
              mode,
              entranceId,
              wheelchair,
              context,
              lang: "ar",
              shareToken: search.token ?? null,
            },
          }),
  });

  const target = targetQuery.data?.ok ? targetQuery.data : null;
  const destination = target?.destination ?? null;

  const savedQuery = useQuery({
    queryKey: ["nav-saved-addresses", signedIn],
    queryFn: () => myAddressesFn({ data: undefined as never }),
    enabled: signedIn,
  });

  const [originQuery, setOriginQuery] = useState("");
  const originSearch = useMutation({
    mutationFn: (value: string) => searchFn({ data: { query: value } }),
  });

  const routeMutation = useMutation({
    mutationFn: async (payload: { origin: Coordinates; destination: Coordinates }) =>
      routeFn({
        data: {
          origin: payload.origin,
          destination: payload.destination,
          mode,
          alternatives: true,
          smartCode: code,
          originMethod,
          destinationKind: destination?.kind ?? null,
          city: destination?.city ?? null,
        },
      }),
  });

  const [selectedRoute, setSelectedRoute] = useState(0);
  const routeData = routeMutation.data;
  const bundle: RouteBundle | null =
    routeData && "bundle" in routeData && routeData.bundle ? (routeData.bundle as RouteBundle) : null;
  const routes = bundle ? [bundle.primary, ...bundle.alternatives] : [];
  const activeRoute = routes[selectedRoute] ?? routes[0] ?? null;
  const path = useMemo(
    () => (activeRoute ? decodePolyline(activeRoute.geometry) : []),
    [activeRoute],
  );

  // Fetch a route whenever origin/destination/mode settle.
  useEffect(() => {
    if (!origin || !destination) return;
    setSelectedRoute(0);
    routeMutation.mutate({ origin, destination: destination.point });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin?.latitude, origin?.longitude, destination?.point.latitude, destination?.point.longitude, mode]);

  const useCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("المتصفح لا يدعم تحديد الموقع");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationDenied(false);
        setPickOnMap(false);
        setOriginMethod("current_location");
        setOriginLabel("موقعي الحالي");
        setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      (err) => {
        setLocationDenied(true);
        setPickOnMap(true);
        setOriginMethod("map_pin");
        const insecure =
          typeof window !== "undefined" &&
          !window.isSecureContext;
        const embedded = typeof window !== "undefined" && window.self !== window.top;
        if (err.code === err.PERMISSION_DENIED) {
          toast.error(
            insecure
              ? "تحديد الموقع يتطلب اتصالاً آمناً (HTTPS) — حددنا الخريطة لاختيار نقطة الانطلاق"
              : embedded
                ? "المعاينة داخل إطار تمنع تحديد الموقع — افتح التطبيق في تبويب مستقل أو اختر نقطة الانطلاق من الخريطة"
                : "تم رفض إذن الموقع من المتصفح — فعّله من إعدادات الموقع، أو اختر نقطة الانطلاق من الخريطة",
          );
        } else if (err.code === err.TIMEOUT) {
          toast.error("انتهت مهلة تحديد الموقع — اختر نقطة الانطلاق من الخريطة أو أعد المحاولة");
        } else {
          toast.error("تعذّر تحديد الموقع الحالي — اختر نقطة الانطلاق من الخريطة");
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );

  }, []);

  // Live GPS while navigating.
  const watchRef = useRef<number | null>(null);
  useEffect(() => {
    if (!navigating || typeof navigator === "undefined" || !navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setLivePoint({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setLocationDenied(true),
      { enableHighAccuracy: true, maximumAge: 4000 },
    );
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [navigating]);

  // Off-route detection, rate limited to one reroute per 20s.
  const lastReroute = useRef(0);
  useEffect(() => {
    if (!navigating || !livePoint || !destination || path.length < 2) return;
    const off = distanceToPath(livePoint, path);
    if (off > 70 && Date.now() - lastReroute.current > 20_000) {
      lastReroute.current = Date.now();
      routeMutation.mutate({ origin: livePoint, destination: destination.point });
      toast.info("خرجت عن المسار — يعاد الحساب");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePoint, navigating]);

  const remaining = useMemo(() => {
    if (!activeRoute) return null;
    if (!livePoint || !destination) {
      return { distance: activeRoute.distance_m, duration: activeRoute.duration_s };
    }
    const direct = haversineMeters(livePoint, destination.point);
    const ratio = activeRoute.distance_m > 0 ? Math.min(1, direct / activeRoute.distance_m) : 0;
    return {
      distance: Math.round(activeRoute.distance_m * ratio),
      duration: Math.round(activeRoute.duration_s * ratio),
    };
  }, [activeRoute, livePoint, destination]);

  const arrived =
    livePoint && destination ? haversineMeters(livePoint, destination.point) < 60 : false;

  const markers: NavMarker[] = useMemo(() => {
    if (!target || !destination) return [];
    const list: NavMarker[] = [];
    const current = livePoint ?? origin;
    if (current) list.push({ id: "origin", kind: "origin", point: current, label: originLabel || "الانطلاق" });
    list.push({
      id: "destination",
      kind: "destination",
      point: destination.point,
      label: destination.point_label_ar,
    });
    if (destination.property_point) {
      list.push({
        id: "property",
        kind: "property",
        point: destination.property_point,
        label: target.property.name,
      });
    }
    for (const entrance of target.entrances) {
      if (entrance.latitude == null || entrance.longitude == null) continue;
      if (entrance.id === destination.entrance_id) continue;
      list.push({
        id: `e-${entrance.id}`,
        kind: entrance.temporarily_closed ? "entrance_closed" : "entrance",
        point: { latitude: entrance.latitude, longitude: entrance.longitude },
        label: entrance.display_name,
        onClick: () => setEntranceId(entrance.id),
      });
    }
    for (const rap of target.road_access_points) {
      list.push({
        id: `r-${rap.id}`,
        kind: rap.parking_available ? "parking" : "road_access",
        point: { latitude: rap.latitude, longitude: rap.longitude },
        label: rap.road_name ?? "نقطة وصول طرقية",
      });
    }
    return list;
  }, [target, destination, origin, livePoint, originLabel]);

  const finalLeg: [number, number][] | undefined =
    destination?.final_leg_on_foot && destination.property_point
      ? [
          [destination.point.longitude, destination.point.latitude],
          [destination.property_point.longitude, destination.property_point.latitude],
        ]
      : undefined;

  const center = destination?.point ?? { latitude: 33.5138, longitude: 36.2765 };

  const setOriginPoint = (point: Coordinates, label: string, method: OriginMethod) => {
    setOrigin(point);
    setOriginLabel(label);
    setOriginMethod(method);
    pushRecent({ label, point });
    setRecents(readRecents());
  };

  const shareMutation = useMutation({
    mutationFn: (shareType: "public_destination" | "private_delivery") =>
      shareFn({
        data: {
          smartCode: code,
          entranceId: destination?.entrance_id ?? null,
          mode,
          shareType,
          expiresInHours: shareType === "private_delivery" ? 24 : 168,
          oneTime: false,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error("تعذّر إنشاء الرابط");
        return;
      }
      const url = `${window.location.origin}/navigation/${code}?token=${result.token}`;
      navigator.clipboard?.writeText(url);
      toast.success("نُسخ رابط المسار إلى الحافظة");
    },
  });

  const [reportCategory, setReportCategory] = useState<string>(ROUTE_REPORT_CATEGORIES[0].value);
  const [reportText, setReportText] = useState("");
  const reportMutation = useMutation({
    mutationFn: () =>
      reportFn({
        data: {
          category: reportCategory,
          description: reportText || null,
          smartCode: code,
          entranceId: destination?.entrance_id ?? null,
          point: origin ?? null,
        },
      }),
    onSuccess: () => {
      toast.success("وصل البلاغ إلى قائمة المراجعة");
      setReportOpen(false);
      setReportText("");
    },
    onError: () => toast.error("تعذّر إرسال البلاغ — سجّل الدخول أولاً"),
  });

  const errorCode =
    targetQuery.data && !targetQuery.data.ok
      ? (targetQuery.data.error as keyof typeof NAV_ERROR_LABELS)
      : routeData && !routeData.ok
        ? (routeData.error as keyof typeof NAV_ERROR_LABELS)
        : null;
  const degraded = routeData && "degraded" in routeData ? routeData.degraded : false;
  const arrival = target?.arrival ?? null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground" dir="rtl">
      <AppHeader />
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row-reverse">
        {/* Map */}
        <div className="relative min-h-[45vh] flex-1">
          <NavigationMap
            markers={markers}
            path={path.length ? path : undefined}
            finalLeg={finalLeg}
            center={center}
            onPick={
              pickOnMap
                ? (point) => {
                    setOriginPoint(point, "نقطة على الخريطة", "map_pin");
                    setPickOnMap(false);
                  }
                : undefined
            }
            className="h-full w-full"
          />
          {pickOnMap && (
            <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow">
              انقر على الخريطة لتحديد نقطة الانطلاق
            </div>
          )}
          <div className="absolute bottom-3 start-3 rounded-lg border border-border bg-background/90 p-2 backdrop-blur">
            <NavigationLegend
              kinds={["origin", "destination", "property", "entrance", "entrance_closed", "road_access", "parking"]}
            />
          </div>
        </div>

        {/* Panel / bottom sheet */}
        <aside
          className={`z-10 flex w-full flex-col border-border bg-surface lg:w-[420px] lg:border-e ${
            sheetOpen ? "max-h-[55vh]" : "max-h-16"
          } overflow-hidden border-t lg:max-h-none lg:border-t-0`}
        >
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            className="flex items-center justify-between px-4 py-3 text-start lg:hidden"
          >
            <span className="text-sm font-semibold">
              {activeRoute
                ? `${formatDistance(activeRoute.distance_m)} · ${formatDuration(activeRoute.duration_s)}`
                : "تفاصيل المسار"}
            </span>
            <span className="text-xs text-muted-foreground">{sheetOpen ? "إخفاء" : "إظهار"}</span>
          </button>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6 pt-2">
            {/* Destination summary */}
            <section className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">الوجهة</p>
                  <h1 className="text-base font-semibold">
                    {target?.property.name ?? "جارٍ تحميل الوجهة…"}
                  </h1>
                  <p className="font-mono text-xs text-muted-foreground">{code}</p>
                </div>
                <Link
                  to="/search"
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
                >
                  بحث
                </Link>
              </div>
              {destination && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground">
                  <Navigation2 className="size-3.5 text-primary" />
                  التوجيه إلى: <strong>{destination.point_label_ar}</strong>
                  <span className="text-muted-foreground">
                    ({DESTINATION_KIND_LABELS[destination.kind].ar})
                  </span>
                </p>
              )}
              {destination?.final_leg_on_foot && (
                <p className="mt-1 text-xs text-muted-foreground">
                  آخر {formatDistance(destination.final_leg_meters ?? 0)} سيراً على الأقدام (الخط
                  المتقطع).
                </p>
              )}
            </section>

            {/* Errors & warnings */}
            {errorCode && (
              <p className="flex items-start gap-2 rounded-lg border border-prohibit/40 bg-prohibit/10 p-3 text-xs">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-prohibit" />
                {NAV_ERROR_LABELS[errorCode]?.ar ?? "حدث خطأ غير متوقع."}
              </p>
            )}
            {degraded && (
              <p className="rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
                تقدير تقريبي بخط مستقيم — خدمة التوجيه غير متاحة حالياً، لا تعتمد عليه للقيادة.
              </p>
            )}
            {(activeRoute?.warnings ?? []).concat(destination?.warnings ?? []).map((w) => (
              <p key={w} className="rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground">
                {WARNING_LABELS[w]?.ar}
              </p>
            ))}

            {/* Origin */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">نقطة الانطلاق</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  <Locate className="size-3.5" /> موقعي الحالي
                </button>
                <button
                  type="button"
                  onClick={() => setPickOnMap(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs"
                >
                  <Crosshair className="size-3.5" /> نقطة على الخريطة
                </button>
              </div>
              {locationDenied && (
                <p className="text-xs text-muted-foreground">
                  رُفض إذن الموقع — استخدم البحث أو حدد نقطة على الخريطة أو أدخل إحداثيات.
                </p>
              )}
              {originLabel && (
                <p className="flex items-center gap-1.5 text-xs">
                  <MapPin className="size-3.5 text-primary" /> {originLabel}
                </p>
              )}

              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 start-2 my-auto size-3.5 text-muted-foreground" />
                <input
                  value={originQuery}
                  onChange={(event) => {
                    setOriginQuery(event.target.value);
                    if (event.target.value.trim().length >= 2) originSearch.mutate(event.target.value);
                  }}
                  placeholder="ابحث عن عنوان ذكي أو عمل تجاري…"
                  className="w-full rounded-md border border-border bg-background py-2 pe-3 ps-8 text-xs focus:border-primary focus:outline-none"
                />
              </div>
              {(originSearch.data?.places ?? []).slice(0, 4).map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() =>
                    place.latitude != null &&
                    place.longitude != null &&
                    setOriginPoint(
                      { latitude: place.latitude, longitude: place.longitude },
                      place.display_name,
                      "smart_address",
                    )
                  }
                  className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-start text-xs hover:border-primary"
                >
                  {place.display_name}
                  <span className="text-muted-foreground"> — {place.neighborhood ?? place.city}</span>
                </button>
              ))}
              {(originSearch.data?.businesses ?? []).slice(0, 3).map((biz) => (
                <button
                  key={biz.id}
                  type="button"
                  onClick={() => {
                    const node = biz.location_nodes as { display_name?: string } | null;
                    toast.info("اختر الموقع من نتائج الأماكن لتحديد الإحداثيات");
                    setOriginQuery(node?.display_name ?? biz.name_ar);
                  }}
                  className="block w-full rounded-md border border-dashed border-border px-2 py-1.5 text-start text-xs"
                >
                  {biz.name_ar} <span className="text-muted-foreground">— عمل تجاري</span>
                </button>
              ))}

              {signedIn && (savedQuery.data ?? []).length > 0 && (
                <details className="rounded-md border border-border bg-background p-2 text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    <Bookmark className="me-1 inline size-3.5" /> عناويني المحفوظة
                  </summary>
                  <div className="mt-2 space-y-1">
                    {(savedQuery.data ?? []).map((addr: any) => {
                      const node = addr.location_nodes;
                      if (!node?.latitude || !node?.longitude) return null;
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() =>
                            setOriginPoint(
                              { latitude: node.latitude, longitude: node.longitude },
                              addr.label ?? node.display_name,
                              "saved_address",
                            )
                          }
                          className="block w-full rounded border border-border px-2 py-1 text-start hover:border-primary"
                        >
                          {addr.label ?? node.display_name}
                        </button>
                      );
                    })}
                  </div>
                </details>
              )}

              {recents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recents.map((recent) => (
                    <button
                      key={recent.label}
                      type="button"
                      onClick={() => setOriginPoint(recent.point, recent.label, "recent")}
                      className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary"
                    >
                      {recent.label}
                    </button>
                  ))}
                </div>
              )}

              <CoordinateEntry onSubmit={(point) => setOriginPoint(point, "إحداثيات يدوية", "coordinates")} />
            </section>

            {/* Routing context — Phase 18 */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">سياق الوصول</p>
              <div className="flex flex-wrap gap-1.5">
                {ROUTING_CONTEXTS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setContext(option.value);
                      setEntranceId(null);
                      setMode(
                        (TRAVEL_MODES.some((m) => m.value === option.travelMode)
                          ? option.travelMode
                          : "walking") as TravelMode,
                      );
                      if (option.requireWheelchair) setWheelchair(true);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                      context === option.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {option.ar}
                  </button>
                ))}
              </div>
              {destination?.context_approach ? (
                <div className="rounded-md border border-primary/40 bg-primary/10 p-2 text-[12px]">
                  <p className="font-bold">
                    تعليمات {routingContext(context).ar}: {destination.context_approach}
                  </p>
                  {destination.context_preferred_road ? (
                    <p className="mt-0.5">الطريق المفضل: {destination.context_preferred_road}</p>
                  ) : null}
                  {destination.context_vehicle_note ? (
                    <p className="mt-0.5">المركبة: {destination.context_vehicle_note}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">{routingContext(context).hintAr}</p>
              )}
            </section>

            {/* Travel mode */}
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">نمط التنقل</p>
              <div className="flex flex-wrap gap-1.5">
                {TRAVEL_MODES.map((option) => {
                  const Icon = MODE_ICON[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${
                        mode === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-3.5" /> {option.ar}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={wheelchair}
                  onChange={(event) => setWheelchair(event.target.checked)}
                />
                أحتاج مدخلاً مهيّأً لكرسي متحرك
              </label>
            </section>

            {/* Entrances */}
            {(target?.entrances.length ?? 0) > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">المدخل</p>
                <button
                  type="button"
                  onClick={() => setEntranceId(null)}
                  className={`w-full rounded-md border px-2 py-1.5 text-start text-xs ${
                    entranceId ? "border-border text-muted-foreground" : "border-primary bg-primary/10"
                  }`}
                >
                  اختيار تلقائي حسب الغرض ونمط التنقل
                </button>
                {(target?.entrances ?? []).map((entrance) => (
                  <button
                    key={entrance.id}
                    type="button"
                    disabled={entrance.temporarily_closed}
                    onClick={() => setEntranceId(entrance.id)}
                    className={`w-full rounded-md border px-2 py-1.5 text-start text-xs disabled:opacity-50 ${
                      entranceId === entrance.id ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <span className="font-medium">{entrance.display_name}</span>{" "}
                    <span className="text-muted-foreground">
                      — {ENTRANCE_KIND_LABELS[entrance.access_type]?.ar ?? entrance.access_type}
                      {entrance.temporarily_closed ? " (مغلق مؤقتاً)" : ""}
                    </span>
                  </button>
                ))}
              </section>
            )}

            {/* Route options */}
            {routes.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">خيارات المسار</p>
                {routes.map((route, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedRoute(index)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs ${
                      selectedRoute === index ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  >
                    <span>{index === 0 ? "المسار الأساسي" : `بديل ${index}`}</span>
                    <span className="font-mono">
                      {formatDistance(route.distance_m)} · {formatDuration(route.duration_s)}
                    </span>
                  </button>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  المصدر: {activeRoute?.provider_attribution} — التقديرات إرشادية وليست مضمونة.
                </p>
              </section>
            )}

            {routeMutation.isPending && (
              <p className="text-xs text-muted-foreground">جارٍ تحضير المسار…</p>
            )}
            {!origin && !routeMutation.isPending && (
              <p className="text-xs text-muted-foreground">اختر نقطة انطلاق لعرض المسار.</p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!activeRoute}
                onClick={() => {
                  setNavigating(true);
                  useCurrentLocation();
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <Play className="size-3.5" /> ابدأ التوجيه
              </button>
              <button
                type="button"
                onClick={() => shareMutation.mutate("public_destination")}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs"
              >
                <Share2 className="size-3.5" /> مشاركة الوجهة
              </button>
              {signedIn && (
                <button
                  type="button"
                  onClick={() => shareMutation.mutate("private_delivery")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs"
                >
                  <Link2 className="size-3.5" /> رابط توصيل خاص
                </button>
              )}
              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs"
              >
                <Flag className="size-3.5" /> الإبلاغ عن مشكلة
              </button>
            </div>

            {reportOpen && (
              <section className="space-y-2 rounded-lg border border-border bg-background p-3">
                <select
                  value={reportCategory}
                  onChange={(event) => setReportCategory(event.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                >
                  {ROUTE_REPORT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.ar}
                    </option>
                  ))}
                </select>
                <textarea
                  value={reportText}
                  onChange={(event) => setReportText(event.target.value)}
                  rows={3}
                  placeholder="وصف المشكلة (اختياري)"
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={() => reportMutation.mutate()}
                  disabled={reportMutation.isPending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                >
                  إرسال البلاغ
                </button>
              </section>
            )}

            {/* Turn-by-turn */}
            {activeRoute && activeRoute.steps.length > 0 && (
              <section className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">التعليمات خطوة بخطوة</p>
                <ol className="space-y-1">
                  {activeRoute.steps.map((step) => (
                    <li
                      key={step.index}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
                    >
                      {instructionWithDistance(step, "ar")}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Last-metre card */}
            {arrival && (
              <section className="space-y-1 rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs">
                <p className="text-sm font-semibold">الأمتار الأخيرة</p>
                {arrival.instruction_text && <p>{arrival.instruction_text}</p>}
                {arrival.entrance_photo && (
                  <img
                    src={arrival.entrance_photo}
                    alt={`صورة ${arrival.entrance_name ?? "المدخل"}`}
                    loading="lazy"
                    className="mt-1 max-h-40 w-full rounded-md object-cover"
                  />
                )}
                <Detail label="المبنى" value={arrival.building_name} />
                <Detail label="المدخل" value={arrival.entrance_name} />
                <Detail label="المَعلم" value={arrival.landmark} />
                <Detail label="وصف الباب" value={arrival.door_description} />
                <Detail label="الطابق" value={arrival.floor} />
                <Detail label="الوحدة" value={arrival.unit_number} />
                <Detail label="الاتصال الداخلي" value={arrival.intercom_name} />
                {arrival.elevator_available != null && (
                  <Detail label="المصعد" value={arrival.elevator_available ? "متوفر" : "غير متوفر"} />
                )}
                <Detail label="ملاحظات الوصول" value={arrival.accessibility_notes} />
                {arrival.call_on_arrival && <p className="font-medium">اتصل بالمستلم عند الوصول.</p>}
                {arrival.delivery_notes && (
                  <p className="rounded border border-border bg-background p-2">
                    {arrival.delivery_notes}
                  </p>
                )}
                {!arrival.private_fields_visible && (
                  <p className="text-muted-foreground">
                    تفاصيل الوحدة الخاصة مخفية — تظهر فقط لصاحب العنوان أو عبر رابط توصيل مصرّح.
                  </p>
                )}
              </section>
            )}
          </div>
        </aside>

        {/* Active navigation overlay */}
        {navigating && activeRoute && (
          <div className="absolute inset-x-0 top-0 z-20 mx-auto w-full max-w-xl p-3">
            <div className="rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {arrived
                      ? "وصلت إلى نقطة الوصول"
                      : instructionWithDistance(activeRoute.steps[0] ?? { index: 0, manoeuvre: "straight", road_name: null, distance_m: 0, duration_s: 0, exit_number: null, way_points: null }, "ar")}
                  </p>
                  {activeRoute.steps[1] && !arrived && (
                    <p className="text-xs text-muted-foreground">
                      ثم: {instructionWithDistance(activeRoute.steps[1], "ar")}
                    </p>
                  )}
                  {remaining && (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      متبقٍ {formatDistance(remaining.distance)} · {formatDuration(remaining.duration)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      origin && destination && routeMutation.mutate({ origin: livePoint ?? origin, destination: destination.point })
                    }
                    className="rounded-md border border-border px-2 py-1 text-xs"
                  >
                    إعادة الحساب
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNavigating(false);
                      setLivePoint(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
                  >
                    <X className="size-3.5" /> إنهاء
                  </button>
                </div>
              </div>
              {arrived && (
                <button
                  type="button"
                  onClick={() => {
                    setNavigating(false);
                    toast.success("تم تأكيد الوصول");
                  }}
                  className="mt-2 w-full rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                >
                  تأكيد الوصول
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

function CoordinateEntry({ onSubmit }: { onSubmit: (point: Coordinates) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-1.5">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        dir="ltr"
        placeholder="33.5138, 36.2765"
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
      />
      <button
        type="button"
        onClick={() => {
          const parts = value.split(",").map((part) => Number(part.trim()));
          const lat = parts[0] ?? NaN;
          const lng = parts[1] ?? NaN;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            toast.error("صيغة الإحداثيات غير صحيحة");
            return;
          }
          onSubmit({ latitude: lat, longitude: lng });
        }}
        className="shrink-0 rounded-md border border-border px-2 py-1.5 text-xs"
      >
        استخدام
      </button>
    </div>
  );
}
