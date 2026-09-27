import { createFileRoute, Link } from "@tanstack/react-router";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Accessibility,
  AlertTriangle,
  Ban,
  BadgeCheck,
  Building2,
  Car,
  Clock,
  Copy,
  DoorOpen,
  Footprints,
  Layers,
  MapPin,
  Package,
  ParkingSquare,
  QrCode,
  Share2,
  ShieldAlert,
  Star,
  Truck,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { LoopStepper } from "@/components/LoopStepper";
import { CadastralMap, type MapPin as Pin } from "@/components/CadastralMap";
import { DirectionsButton } from "@/components/DirectionsButton";
import { QrCardLazy as QrCard } from "@/components/QrCardLazy";
import { supabase } from "@/integrations/supabase/client";
import { resolveAddress } from "@/lib/addresses.functions";
import { ROUTING_CONTEXTS, routingContextHint, routingContextLabel, type RoutingContext } from "@/lib/routing-contexts";
import { listFavorites, toggleFavorite } from "@/lib/network.functions";
import { logAddressEvent } from "@/lib/orgs.functions";
import { rememberAddress } from "@/lib/offline/store";
import {
  ACCESSIBILITY_LABELS,
  NODE_TYPE_LABELS,
  VERIFICATION_LEVELS,
  confidenceBand,
  formatCoords,
  normalizeCode,
} from "@/lib/smart-address";
import type { TravelMode } from "@/lib/navigation/types";
import { formatAddressLine, formatLocality, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/a/$code")({
  loader: ({ params }) =>
    resolveAddress({ data: { code: params.code, purpose: "visitor", context: "standard" } }),
  head: ({ params }) => ({
    meta: [
      { title: `${normalizeCode(params.code)} — بطاقة العنوان الذكي | سيرياسان` },
      {
        name: "description",
        content:
          "بطاقة وجهة كاملة للعنوان الذكي: المبنى، المدخل، الطابق، المعالم، تعليمات الوصول وحالة التوثيق مع أزرار التوجيه والمشاركة.",
      },
      { property: "og:title", content: `بطاقة العنوان الذكي ${normalizeCode(params.code)}` },
      {
        property: "og:description",
        content: "كل ما يلزم للوصول إلى المكان الصحيح: المدخل، الطابق، المعالم وتعليمات الوصول.",
      },
      { property: "og:type", content: "place" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => {
    const { t } = useI18n();
    return (
      <Shell>
        <p className="text-center font-bold">
          {t({ ar: "تعذر تحميل بطاقة العنوان", en: "We couldn't load this address card" })}
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t({ ar: "أعد المحاولة بعد قليل.", en: "Please try again in a moment." })}
        </p>
      </Shell>
    );
  },
  notFoundComponent: () => {
    const { t } = useI18n();
    return (
      <Shell>
        <p className="text-center font-bold">
          {t({ ar: "لا يوجد عنوان بهذا الرمز", en: "No address exists with this code" })}
        </p>
      </Shell>
    );
  },
  component: AddressCardPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary">
      <AppHeader />
      <div className="mx-auto max-w-3xl p-4">
        <div className="rounded-xl border border-border bg-background p-6">{children}</div>
      </div>
    </div>
  );
}

const TRAVEL_OPTIONS: { mode: TravelMode; ar: string; en: string; icon: typeof Car }[] = [
  { mode: "driving", ar: "سيارة", en: "Driving", icon: Car },
  { mode: "walking", ar: "مشياً", en: "Walking", icon: Footprints },
  { mode: "delivery", ar: "توصيل", en: "Delivery", icon: Package },
  { mode: "heavy", ar: "شاحنة", en: "Truck", icon: Truck },
];

function Row({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof MapPin;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex gap-2 rounded-lg border border-border bg-surface p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span
          className={`mt-0.5 block break-words text-sm ${mono ? "font-mono" : ""}`}
          dir={mono ? "ltr" : undefined}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

const CONTEXT_KEY = "ssan.routing.context";

function AddressCardPage() {
  const { t, lang, date } = useI18n();
  const loaded = Route.useLoaderData();
  const { code: rawCode } = Route.useParams();
  const [showQr, setShowQr] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [saved, setSaved] = useState(false);
  const toggleFav = useServerFn(toggleFavorite);
  const listFavs = useServerFn(listFavorites);
  const resolveFn = useServerFn(resolveAddress);

  // Phase 18 — the same address answers differently per routing context.
  const [context, setContext] = useState<RoutingContext>("standard");
  const [result, setResult] = useState(loaded);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(CONTEXT_KEY);
    if (stored && ROUTING_CONTEXTS.some((c) => c.value === stored)) {
      setContext(stored as RoutingContext);
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (context === "standard") {
      setResult(loaded);
      return () => {
        active = false;
      };
    }
    setSwitching(true);
    void resolveFn({ data: { code: rawCode, context } })
      .then((next) => {
        if (active) setResult(next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setSwitching(false);
      });
    return () => {
      active = false;
    };
  }, [context, loaded, rawCode, resolveFn]);

  const ok = result.status === "ok" ? result : null;

  useEffect(() => {
    if (!ok) return;
    const fromQr =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).get("s") === "qr";
    void logAddressEvent({
      data: { code: normalizeCode(rawCode), event: "resolve", source: fromQr ? "qr" : "card" },
    }).catch(() => undefined);
    if (fromQr) {
      void logAddressEvent({
        data: { code: normalizeCode(rawCode), event: "qr_scan", source: "card" },
      }).catch(() => undefined);
    }
    // Keep a local copy so this address stays readable without a connection.
    rememberAddress({
      code: ok.code,
      display_name: ok.site.display_name,
      governorate: ok.site.governorate,
      city: ok.site.city,
      neighborhood: ok.site.neighborhood,
      street: ok.site.street,
      landmark: ok.site.landmark,
      latitude: ok.site.latitude,
      longitude: ok.site.longitude,
      verification_level: ok.verification_level,
      confidence_score: ok.confidence,
    });
  }, [ok, rawCode]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const isIn = Boolean(data.session);
      setSignedIn(isIn);
      if (isIn && ok) {
        try {
          const favs = await listFavs();
          if (active) setSaved(favs.some((f) => f.smart_addresses?.code === ok.code));
        } catch {
          // favourites unavailable — save button simply starts unselected
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [listFavs, ok]);

  if (!ok) {
    return (
      <Shell>
        <p className="text-center font-bold">
          {result.status === "not_found"
            ? t({ ar: "لا يوجد عنوان ذكي عام بهذا الرمز", en: "No public smart address exists with this code" })
            : result.status === "retired"
              ? t({ ar: "هذا الرمز مُتقاعد", en: "This code has been retired" })
              : t({ ar: "هذا العنوان خاص ولا يمكن عرضه علناً", en: "This address is private and can't be shown publicly" })}
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t({
            ar: "العناوين السكنية خاصة افتراضياً — يحتاج المُرسل رابطاً مؤقتاً من صاحب العنوان.",
            en: "Residential addresses are private by default — senders need a temporary link from the address owner.",
          })}
        </p>
        <p className="mt-4 text-center font-mono text-xs text-muted-foreground" dir="ltr">
          {normalizeCode(rawCode)}
        </p>
        <Link to="/" className="mt-5 block text-center text-sm font-bold text-primary">
          {t({ ar: "العودة إلى البحث", en: "Back to search" })}
        </Link>
      </Shell>
    );
  }

  const ap = ok.recommended;
  const unit = ok.chain.find((n) => n.unit_label);
  const floor = ok.chain.find((n) => n.floor_label);
  const building = ok.chain.find((n) => n.node_type === "building");
  const band = confidenceBand(ok.confidence);
  const shareUrl =
    typeof window === "undefined" ? `https://syriasan.com/a/${ok.code}` : `${window.location.origin}/a/${ok.code}`;
  const lat = ap?.latitude ?? ok.site.latitude;
  const lng = ap?.longitude ?? ok.site.longitude;
  const pins: Pin[] =
    lat != null && lng != null
      ? [{ id: ok.code, latitude: lat, longitude: lng, label: ok.site.display_name, tone: "recommended" as const }]
      : [];

  const verifiedAt = ap?.last_verified_at ?? ok.site.last_verified_at;

  return (
    <div className="min-h-screen bg-secondary">
      <AppHeader />
      <div className="mx-auto max-w-3xl space-y-4 p-4">
        <LoopStepper current="resolve" />
        <section className="overflow-hidden rounded-xl border border-border bg-background shadow-plate">
          <div className="bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-mono text-sm font-bold tracking-widest text-primary" dir="ltr">
                  {ok.code}
                </span>
                <h1 className="mt-1 text-xl font-bold leading-tight">{ok.site.display_name}</h1>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatAddressLine(
                    {
                      street: ok.site.street,
                      neighborhood: ok.site.neighborhood,
                      district: ok.site.district,
                      city: ok.site.city,
                      governorate: ok.site.governorate,
                    },
                    lang,
                  )}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-surface px-2 py-1 text-[10px] font-bold">
                {NODE_TYPE_LABELS[ok.site.node_type] ?? ok.site.node_type}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <VerifiedBadge kind="address" level={ok.verification_level} />
              {ok.business ? <VerifiedBadge kind="business" level={ok.business.verification_level} /> : null}
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 font-bold">
                <BadgeCheck className="size-3.5 text-primary" />
                {VERIFICATION_LEVELS[ok.verification_level]?.ar ?? t({ ar: "غير موثق", en: "Not verified" })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1">
                <span
                  className={`size-2 rounded-full ${band.tone === "high" ? "bg-allow" : band.tone === "medium" ? "bg-primary" : "bg-prohibit"}`}
                />
                {band.ar} ({ok.confidence}%)
              </span>
              {verifiedAt ? (
                <span className="rounded-md border border-border bg-surface px-2 py-1 text-muted-foreground">
                  {t({ ar: "آخر توثيق:", en: "Last verified:" })} {date(verifiedAt, { dateStyle: "medium" })}
                </span>
              ) : (
                <span className="rounded-md border border-border bg-surface px-2 py-1 text-muted-foreground">
                  {t({ ar: "لم يُوثق ميدانياً بعد", en: "Not field-verified yet" })}
                </span>
              )}
            </div>
          </div>

          <div className="h-52">
            <CadastralMap
              fill
              center={{ latitude: lat ?? 33.5138, longitude: lng ?? 36.2765 }}
              pins={pins}
              className="h-52"
            />
          </div>

          <div className="space-y-3 p-4">
            {ok.business ? (
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{ok.business.name_ar}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[ok.business.category, ok.business.name_en].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-background px-2 py-1 text-[10px] font-bold">
                    {VERIFICATION_LEVELS[ok.business.verification_level]?.ar ?? t({ ar: "غير موثق", en: "Not verified" })}
                  </span>
                </div>
                {ok.business.opening_hours ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px]">
                    <Clock className="size-3.5 text-muted-foreground" /> {ok.business.opening_hours}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
                  {ok.business.phone ? (
                    <a
                      href={`tel:${ok.business.phone}`}
                      dir="ltr"
                      className="rounded-lg border border-border px-3 py-1.5"
                    >
                      {ok.business.phone}
                    </a>
                  ) : null}
                  {ok.business.website ? (
                    <a
                      href={ok.business.website}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-border px-3 py-1.5"
                    >
                      {t({ ar: "الموقع الإلكتروني", en: "Website" })}
                    </a>
                  ) : null}
                  <Link
                    to="/business/$id"
                    params={{ id: ok.business.id }}
                    className="rounded-lg border border-border px-3 py-1.5"
                  >
                    {t({ ar: "صفحة النشاط", en: "Business page" })}
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <Row icon={MapPin} label={t({ ar: "الإحداثيات", en: "Coordinates" })} value={formatCoords(lat, lng)} mono />
              <Row
                icon={Building2}
                label={t({ ar: "المبنى", en: "Building" })}
                value={
                  building
                    ? `${building.display_name}${
                        ok.site.building_number
                          ? ` · ${t({ ar: "رقم", en: "No." })} ${ok.site.building_number}`
                          : ""
                      }`
                    : ok.site.building_number
                      ? `${t({ ar: "رقم", en: "No." })} ${ok.site.building_number}`
                      : null
                }
              />
              <Row icon={DoorOpen} label={t({ ar: "المدخل", en: "Entrance" })} value={ap?.display_name ?? null} />
              <Row icon={Layers} label={t({ ar: "الطابق", en: "Floor" })} value={floor?.floor_label ?? null} />
              <Row icon={Layers} label={t({ ar: "الوحدة / الشقة", en: "Unit / apartment" })} value={unit?.unit_label ?? null} />
              <Row icon={MapPin} label={t({ ar: "أقرب معلم", en: "Nearest landmark" })} value={ok.site.landmark} />
              <Row
                icon={ParkingSquare}
                label={t({ ar: "المواقف", en: "Parking" })}
                value={ap?.parking_info ?? ok.site.parking_info}
              />
              <Row
                icon={Truck}
                label={t({ ar: "التحميل والتنزيل", en: "Loading and unloading" })}
                value={ap?.loading_info ?? ok.site.loading_info}
              />
              <Row
                icon={Clock}
                label={t({ ar: "ساعات المدخل", en: "Entrance hours" })}
                value={
                  ap
                    ? ap.hours.always_open
                      ? t({ ar: "مفتوح 24/7", en: "Open 24/7" })
                      : `${ap.hours.opens_at?.slice(0, 5) ?? "—"} – ${ap.hours.closes_at?.slice(0, 5) ?? "—"}`
                    : null
                }
                mono
              />
              <Row
                icon={Accessibility}
                label={t({ ar: "إمكانية الوصول", en: "Accessibility" })}
                value={
                  ap && ap.accessibility.length
                    ? ap.accessibility.map((a) => ACCESSIBILITY_LABELS[a] ?? a).join(lang === "ar" ? "، " : ", ")
                    : ok.site.wheelchair_accessible
                      ? t({ ar: "مناسب لكرسي متحرك", en: "Wheelchair accessible" })
                      : ok.site.has_elevator
                        ? t({ ar: "يوجد مصعد", en: "Elevator available" })
                        : null
                }
              />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t({ ar: "سياق الوصول", en: "Routing context" })}
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {ROUTING_CONTEXTS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setContext(c.value);
                      window.localStorage.setItem(CONTEXT_KEY, c.value);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                      context === c.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface hover:border-primary/50"
                    }`}
                  >
                    {routingContextLabel(c.value, lang)}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {switching
                  ? t({ ar: "جارٍ تحديث المدخل الموصى به…", en: "Updating the recommended entrance…" })
                  : routingContextHint(context, lang)}
              </p>
            </div>

            {ap?.context_approach ? (
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  {t({ ar: "تعليمات", en: "Instructions for" })} {routingContextLabel(context, lang)}
                </span>
                <p className="mt-1 text-sm font-bold">{ap.context_approach}</p>
                {ap.context_preferred_road ? (
                  <p className="mt-1 text-[12px]">
                    {t({ ar: "الطريق المفضل:", en: "Preferred road:" })} {ap.context_preferred_road}
                  </p>
                ) : null}
                {ap.context_vehicle_note ? (
                  <p className="mt-0.5 text-[12px]">
                    {t({ ar: "المركبة:", en: "Vehicle:" })} {ap.context_vehicle_note}
                  </p>
                ) : null}
                {ap.context_note ? (
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{ap.context_note}</p>
                ) : null}
              </div>
            ) : null}

            {ap?.instructions ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  {t({ ar: "تعليمات الوصول", en: "Access instructions" })}
                </span>
                <p className="mt-1 text-sm">{ap.instructions}</p>
              </div>
            ) : null}

            {ok.site.public_notes ? (
              <p className="rounded-lg border border-border bg-surface p-3 text-sm">{ok.site.public_notes}</p>
            ) : null}

            {ok.restrictions.length ? (
              <div className="space-y-1.5">
                {ok.restrictions.map((r) => (
                  <p
                    key={r}
                    className="flex items-start gap-2 rounded-lg bg-surface p-2 text-[12px] text-muted-foreground"
                  >
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                    {r}
                  </p>
                ))}
              </div>
            ) : null}

            {ok.prohibited.length ? (
              <div className="space-y-1.5">
                {ok.prohibited.map((p) => (
                  <p
                    key={p.display_name}
                    className="flex items-start gap-2 rounded-lg bg-prohibit-surface p-2 text-[12px] text-prohibit"
                  >
                    <Ban className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      <strong>{p.display_name}</strong> — {p.reason}
                    </span>
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-background p-4">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t({ ar: "التوجيه إلى هذا العنوان", en: "Directions to this address" })}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TRAVEL_OPTIONS.map((opt) => (
              <DirectionsButton
                key={opt.mode}
                code={ok.code}
                mode={opt.mode}
                label={t({ ar: opt.ar, en: opt.en })}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-3 text-sm font-bold hover:border-primary/50"
              />
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {t({
              ar: "المسارات الخاصة بالشاحنات وكراسي المتحركين والطوارئ تُعرض كتوجيه قياسي ما لم تتوفر بيانات طرق كافية.",
              en: "Truck, wheelchair and emergency routes are shown as standard directions unless enough road data is available.",
            })}
          </p>

          <Link
            to="/d/$code"
            params={{ code: ok.code }}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-primary/40 bg-primary/5 px-4 py-3 text-sm font-bold text-primary"
          >
            <Package className="size-4" />
            {t({ ar: "وضع التوصيل — عرض مبسّط للساعي", en: "Delivery mode — simplified courier view" })}
          </Link>

          <Link
            to="/e/$code"
            params={{ code: ok.code }}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 px-4 py-3 text-sm font-bold text-destructive"
          >
            <AlertTriangle className="size-4" />
            {t({ ar: "وضع الطوارئ — معلومات الوصول السريع", en: "Emergency mode — rapid access information" })}
          </Link>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                const text = `${ok.code} — ${ok.site.display_name}`;
                if (typeof navigator !== "undefined" && navigator.share) {
                  try {
                    await navigator.share({ title: text, url: shareUrl });
                    return;
                  } catch {
                    // share sheet dismissed — fall through to copying the link
                  }
                }
                await navigator.clipboard.writeText(shareUrl);
                toast.success(t({ ar: "تم نسخ رابط العنوان", en: "Address link copied" }));
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-bold"
            >
              <Share2 className="size-4" /> {t({ ar: "مشاركة", en: "Share" })}
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(ok.code);
                toast.success(t({ ar: "تم نسخ العنوان الذكي", en: "Smart address copied" }));
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-bold"
            >
              <Copy className="size-4" /> {t({ ar: "نسخ الرمز", en: "Copy code" })}
            </button>
            <button
              type="button"
              onClick={() => setShowQr((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-bold"
            >
              <QrCode className="size-4" /> {t({ ar: "رمز QR", en: "QR code" })}
            </button>
            {signedIn ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await toggleFav({
                      data: { code: ok.code, label: ok.site.display_name },
                    });
                    setSaved(res.saved);
                    toast.success(
                      res.saved
                        ? t({ ar: "حُفظ في المفضلة", en: "Saved to favourites" })
                        : t({ ar: "أُزيل من المفضلة", en: "Removed from favourites" }),
                    );
                  } catch {
                    toast.error(t({ ar: "تعذر تحديث المفضلة", en: "Couldn't update favourites" }));
                  }
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-bold ${
                  saved ? "border-primary/40 bg-primary/10 text-primary" : "border-border"
                }`}
              >
                <Star className="size-4" fill={saved ? "currentColor" : "none"} />
                {saved ? t({ ar: "محفوظ", en: "Saved" }) : t({ ar: "حفظ العنوان", en: "Save address" })}
              </button>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-bold"
              >
                <Star className="size-4" /> {t({ ar: "سجّل الدخول للحفظ", en: "Sign in to save" })}
              </Link>
            )}
          </div>

          {showQr ? (
            <QrCard
              url={`${shareUrl}?s=qr`}
              code={ok.code}
              title={ok.site.display_name}
              subtitle={formatLocality({ neighborhood: ok.site.neighborhood, city: ok.site.city }, lang)}
              logoUrl={ok.business?.logo_url}
              onClose={() => setShowQr(false)}
            />
          ) : null}
        </section>

        {ok.alternatives.length ? (
          <section className="rounded-xl border border-border bg-background p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t({ ar: "مداخل بديلة", en: "Alternative entrances" })}
            </h2>
            <div className="space-y-2">
              {ok.alternatives.map((alt) => (
                <div
                  key={alt.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{alt.display_name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                      {formatCoords(alt.latitude, alt.longitude)}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold ${alt.open_now ? "text-allow" : "text-prohibit"}`}>
                    {alt.open_now ? t({ ar: "مفتوح", en: "Open" }) : t({ ar: "مغلق", en: "Closed" })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <p className="pb-6 text-center text-[10px] text-muted-foreground">
          {t({
            ar: "تفاصيل الوحدات السكنية وأسماء السكان لا تُعرض علناً — تُشارك فقط عبر رابط مؤقت من صاحب العنوان.",
            en: "Residential unit details and resident names aren't shown publicly — they're shared only via a temporary link from the address owner.",
          })}
        </p>
      </div>
    </div>
  );
}
