import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Crosshair, MapPin, Plus, Route as RouteIcon, Trash2, Truck } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { NavigationMap, type NavMarker } from "@/components/NavigationMap";
import { supabase } from "@/integrations/supabase/client";
import {
  getNavigationTarget,
  listCourierRoutes,
  optimizeCourierRoute,
} from "@/lib/navigation/navigation.functions";
import { formatDistance, formatDuration } from "@/lib/navigation/geo";
import type { Coordinates } from "@/lib/navigation/types";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/courier")({
  head: () => ({
    meta: [
      { title: "مسارات التوصيل متعددة المحطات" },
      {
        name: "description",
        content:
          "خطّط مسار توصيل متعدد المحطات على الشبكة السورية للعنوان الذكي: ترتيب أمثل، أوقات وصول تقديرية، ومداخل دقيقة بدل مراكز المباني.",
      },
      { property: "og:title", content: "مسارات التوصيل — الشبكة السورية للعنوان الذكي" },
      {
        property: "og:description",
        content: "رتّب محطات التوصيل تلقائياً واحصل على أزمنة وصول تقديرية لكل محطة.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CourierPage,
});

type Stop = {
  ref: string;
  label: string;
  smartCode: string | null;
  location: Coordinates;
  serviceTimeS: number;
};

const DAMASCUS: Coordinates = { latitude: 33.5138, longitude: 36.2765 };

function parseCoords(text: string): Coordinates | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function CourierPage() {
  const { t, lang, isRtl } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const optimizeFn = useServerFn(optimizeCourierRoute);
  const listFn = useServerFn(listCourierRoutes);
  const targetFn = useServerFn(getNavigationTarget);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [name, setName] = useState(t({ ar: "مسار توصيل", en: "Delivery route" }));
  const [mode, setMode] = useState<"delivery" | "driving" | "cycling" | "walking">("delivery");
  const [start, setStart] = useState<Coordinates>(DAMASCUS);
  const [returnToStart, setReturnToStart] = useState(true);
  const [stops, setStops] = useState<Stop[]>([]);
  const [pickTarget, setPickTarget] = useState<"start" | "stop" | null>(null);
  const [draftCode, setDraftCode] = useState("");
  const [draftCoords, setDraftCoords] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [result, setResult] = useState<{
    order: { ref: string; arrival_s: number }[];
    unassigned: string[];
    total_distance_m: number;
    total_duration_s: number;
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const saved = useQuery({
    queryKey: ["courier-routes"],
    queryFn: () => listFn({}),
    enabled: authed === true,
  });

  const addStop = (location: Coordinates, label: string, smartCode: string | null) => {
    setStops((prev) => [
      ...prev,
      {
        ref: `s${Date.now()}${prev.length}`,
        label: label || t({ ar: `محطة ${prev.length + 1}`, en: `Stop ${prev.length + 1}` }),
        smartCode,
        location,
        serviceTimeS: 180,
      },
    ]);
    setDraftCode("");
    setDraftCoords("");
    setDraftLabel("");
    setResult(null);
  };

  const resolveCode = useMutation({
    mutationFn: async (code: string) =>
      targetFn({ data: { code: code.trim().toUpperCase(), mode, lang } }),
    onSuccess: (res) => {
      if (!res.ok || !res.destination) {
        toast.error(t({ ar: "تعذّر العثور على هذا العنوان الذكي", en: "Couldn't find this smart address" }));
        return;
      }
      const d = res.destination;
      addStop(d.point, draftLabel || d.property_name || d.smart_code, d.smart_code);
      toast.success(t({ ar: `أُضيفت المحطة: ${d.point_label_ar ?? d.property_name}`, en: `Stop added: ${d.point_label_ar ?? d.property_name}` }));
    },
    onError: () => toast.error(t({ ar: "تعذّر الاتصال بخدمة العناوين", en: "Couldn't connect to the addressing service" })),
  });

  const optimize = useMutation({
    mutationFn: async () =>
      optimizeFn({
        data: {
          name,
          mode,
          start,
          end: returnToStart ? start : null,
          stops: stops.map((s) => ({
            ref: s.ref,
            smartCode: s.smartCode,
            location: s.location,
            serviceTimeS: s.serviceTimeS,
          })),
          save: true,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(
          res.error === "routing_not_configured"
            ? t({ ar: "خدمة التوجيه غير مهيّأة", en: "Routing service isn't configured" })
            : res.error === "rate_limited"
              ? t({ ar: "تجاوزت الحد المسموح، أعد المحاولة بعد قليل", en: "You've hit the rate limit — try again shortly" })
              : t({ ar: "تعذّر حساب المسار الأمثل", en: "Couldn't calculate the optimal route" }),
        );
        return;
      }
      setResult(res.result);
      queryClient.invalidateQueries({ queryKey: ["courier-routes"] });
      toast.success(t({ ar: "تم ترتيب المحطات", en: "Stops have been ordered" }));
    },
    onError: () => toast.error(t({ ar: "تعذّر الاتصال بمحرك التحسين", en: "Couldn't connect to the optimization engine" })),
  });

  const orderedStops = useMemo(() => {
    if (!result) return stops.map((s, i) => ({ stop: s, position: i, eta: null as number | null }));
    const rank = new Map(result.order.map((o, i) => [o.ref, i]));
    const eta = new Map(result.order.map((o) => [o.ref, o.arrival_s]));
    return [...stops]
      .sort((a, b) => (rank.get(a.ref) ?? 999) - (rank.get(b.ref) ?? 999))
      .map((s) => ({ stop: s, position: rank.get(s.ref) ?? -1, eta: eta.get(s.ref) ?? null }));
  }, [stops, result]);

  const markers: NavMarker[] = useMemo(
    () => [
      { id: "start", kind: "origin", point: start, label: t({ ar: "نقطة الانطلاق", en: "Starting point" }) },
      ...orderedStops.map(({ stop, position }) => ({
        id: stop.ref,
        kind: "destination" as const,
        point: stop.location,
        label: `${position >= 0 ? position + 1 : "•"} — ${stop.label}`,
      })),
    ],
    [start, orderedStops, t],
  );

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign in required" })}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t({
              ar: "مسارات التوصيل مرتبطة بحسابك ولا تُشارك بيانات المستلمين.",
              en: "Delivery routes are tied to your account and recipient data is never shared.",
            })}
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/courier" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir={isRtl ? "rtl" : "ltr"}>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6 lg:grid-cols-[1fr_420px]">
        <section className="order-2 h-[420px] overflow-hidden rounded-xl border border-border lg:order-1 lg:h-[calc(100vh-8rem)]">
          <NavigationMap
            markers={markers}
            center={start}
            className="h-full w-full"
            onPick={(point) => {
              if (pickTarget === "start") setStart(point);
              else if (pickTarget === "stop") addStop(point, draftLabel, null);
              setPickTarget(null);
            }}
          />
        </section>

        <section className="order-1 space-y-4 lg:order-2">
          <header className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-primary">
              <Truck className="h-5 w-5" />
              <h1 className="text-lg font-bold">{t({ ar: "مسار توصيل متعدد المحطات", en: "Multi-stop delivery route" })}</h1>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t({
                ar: "يوجّه المسار إلى المدخل أو نقطة الوصول الطرقية لكل عنوان، لا إلى مركز المبنى.",
                en: "The route directs to each address's entrance or road access point, not the building's center.",
              })}
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder={t({ ar: "اسم المسار", en: "Route name" })}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["delivery", t({ ar: "مركبة توصيل", en: "Delivery vehicle" })],
                  ["driving", t({ ar: "سيارة", en: "Car" })],
                  ["cycling", t({ ar: "دراجة", en: "Bicycle" })],
                  ["walking", t({ ar: "مشياً", en: "On foot" })],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                    mode === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </header>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">{t({ ar: "نقطة الانطلاق", en: "Starting point" })}</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {start.latitude.toFixed(6)}, {start.longitude.toFixed(6)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  navigator.geolocation?.getCurrentPosition(
                    (pos) =>
                      setStart({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                    () => toast.error(t({ ar: "تعذّر تحديد موقعك", en: "Couldn't determine your location" })),
                  )
                }
                className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                <Crosshair className="h-3.5 w-3.5" /> {t({ ar: "موقعي الحالي", en: "My current location" })}
              </button>
              <button
                type="button"
                onClick={() => setPickTarget("start")}
                className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs ${
                  pickTarget === "start" ? "border-primary text-primary" : "border-border"
                }`}
              >
                <MapPin className="h-3.5 w-3.5" /> {t({ ar: "اختيار من الخريطة", en: "Pick from the map" })}
              </button>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={returnToStart}
                  onChange={(e) => setReturnToStart(e.target.checked)}
                />
                {t({ ar: "العودة لنقطة الانطلاق", en: "Return to starting point" })}
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">{t({ ar: "إضافة محطة", en: "Add a stop" })}</h2>
            <input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder={t({ ar: "اسم المحطة (اختياري)", en: "Stop name (optional)" })}
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-2 flex gap-2">
              <input
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
                placeholder="SY-DAM-XXXX-XX"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
              />
              <button
                type="button"
                disabled={draftCode.trim().length < 6 || resolveCode.isPending}
                onClick={() => resolveCode.mutate(draftCode)}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {t({ ar: "إضافة بالرمز", en: "Add by code" })}
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={draftCoords}
                onChange={(e) => setDraftCoords(e.target.value)}
                placeholder="33.5138, 36.2765"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const c = parseCoords(draftCoords);
                  if (!c) {
                    toast.error(t({ ar: "صيغة الإحداثيات غير صحيحة", en: "Invalid coordinate format" }));
                    return;
                  }
                  addStop(c, draftLabel, null);
                }}
                className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
              >
                {t({ ar: "إضافة بالإحداثيات", en: "Add by coordinates" })}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPickTarget("stop")}
              className={`mt-2 flex w-full items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold ${
                pickTarget === "stop" ? "border-primary text-primary" : "border-border"
              }`}
            >
              <Plus className="h-3.5 w-3.5" /> {t({ ar: "إضافة محطة بالضغط على الخريطة", en: "Add a stop by tapping the map" })}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">{t({ ar: "المحطات", en: "Stops" })} ({stops.length})</h2>
              {result ? (
                <span className="text-xs text-muted-foreground">
                  {formatDistance(result.total_distance_m, lang)} ·{" "}
                  {formatDuration(result.total_duration_s, lang)}
                </span>
              ) : null}
            </div>
            <ol className="mt-3 space-y-2">
              {orderedStops.map(({ stop, position, eta }) => (
                <li
                  key={stop.ref}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {position >= 0 ? position + 1 : "•"}
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{stop.label}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {stop.smartCode ??
                        `${stop.location.latitude.toFixed(5)}, ${stop.location.longitude.toFixed(5)}`}
                    </span>
                  </span>
                  {eta != null ? (
                    <span className="text-[11px] text-muted-foreground">
                      {t({ ar: "وصول ~", en: "arrival ~" })} {formatDuration(eta, lang)}
                    </span>
                  ) : null}
                  {result?.unassigned.includes(stop.ref) ? (
                    <span className="text-[11px] font-bold text-destructive">{t({ ar: "تعذّر الوصول", en: "Unreachable" })}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setStops((prev) => prev.filter((s) => s.ref !== stop.ref));
                      setResult(null);
                    }}
                    aria-label={t({ ar: "حذف المحطة", en: "Delete stop" })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {stops.length === 0 ? (
                <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  {t({ ar: "أضف محطتين على الأقل لبدء الترتيب الأمثل.", en: "Add at least two stops to start optimal ordering." })}
                </li>
              ) : null}
            </ol>
            <button
              type="button"
              disabled={stops.length < 2 || optimize.isPending}
              onClick={() => optimize.mutate()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              <RouteIcon className="h-4 w-4" />
              {optimize.isPending ? t({ ar: "جارٍ الترتيب…", en: "Ordering…" }) : t({ ar: "رتّب المسار الأمثل", en: "Optimize route" })}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">{t({ ar: "مساراتي المحفوظة", en: "My saved routes" })}</h2>
            <ul className="mt-2 space-y-2">
              {(saved.data?.routes ?? []).map((r: any) => (
                <li key={r.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                  <span className="font-semibold">{r.name}</span>
                  <span className="mx-2 text-muted-foreground">
                    {r.courier_route_stops?.length ?? 0} {t({ ar: "محطة", en: "stops" })}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDistance(r.total_distance_m ?? 0, lang)} ·{" "}
                    {formatDuration(r.total_duration_s ?? 0, lang)}
                  </span>
                </li>
              ))}
              {saved.data && saved.data.routes.length === 0 ? (
                <li className="text-xs text-muted-foreground">{t({ ar: "لا توجد مسارات محفوظة بعد.", en: "No saved routes yet." })}</li>
              ) : null}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
