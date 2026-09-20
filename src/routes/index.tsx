import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Ban,
  CircleCheck,
  Clock,
  Copy,
  Navigation,
  QrCode,
  Search,
  Star,
  Timer,
  WifiOff,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { DirectionsButton } from "@/components/DirectionsButton";
import { AddressFeedback } from "@/components/AddressFeedback";
import { QrCard } from "@/components/QrCard";
import { CadastralMap, type MapPin } from "@/components/CadastralMap";
import { HierarchySpine, type SpineLevel } from "@/components/HierarchySpine";
import { supabase } from "@/integrations/supabase/client";
import { resolveAddress } from "@/lib/addresses.functions";
import { listFavorites, toggleFavorite } from "@/lib/network.functions";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  ACCESSIBILITY_LABELS,
  PURPOSE_LABELS,
  PURPOSES,
  QUICK_PURPOSES,
  VERIFICATION_LEVELS,
  confidenceBand,
  formatCoords,
  normalizeCode,
  osmDirectionsUrl,
  type Purpose,
} from "@/lib/smart-address";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { code?: string } =>
    typeof search["code"] === "string" ? { code: search["code"] } : {},
  head: () => ({
    meta: [
      { title: "محلّل العنوان الذكي | شبكة العنوان الذكي السورية" },
      {
        name: "description",
        content:
          "حلّل أي عنوان ذكي سوري حسب الغرض: مدخل التوصيل، مدخل الزوار، بوابة الشاحنات أو مدخل الطوارئ — مع الإحداثيات والقيود وساعات العمل.",
      },
      { property: "og:title", content: "محلّل العنوان الذكي — شبكة العنوان الذكي السورية" },
      {
        property: "og:description",
        content: "عنوان ذكي دقيق لكل مكان: المبنى، المدخل، الطابق والوحدة — وليس مجرد نقطة على الخريطة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResolverPage,
});

const DEMO_CODES = [
  { code: "SY-DAM-K7X4", ar: "برج سكني — دمشق", en: "Residential tower — Damascus" },
  { code: "SY-DAM-9M4Q", ar: "مركز طبي — المزة", en: "Medical centre — Mazzeh" },
  { code: "SY-RDA-82KF", ar: "مستودع — عدرا", en: "Warehouse — Adra" },
];

/** English labels keyed by purpose value, used alongside the shared Arabic PURPOSE_LABELS map. */
const PURPOSE_LABELS_EN: Record<string, string> = Object.fromEntries(
  PURPOSES.map((p) => [p.value, p.en]),
);

function purposeLabel(value: string, lang: Lang): string {
  return lang === "ar" ? (PURPOSE_LABELS[value] ?? value) : (PURPOSE_LABELS_EN[value] ?? value);
}

const VERIFICATION_LABELS_EN: Record<string, string> = {
  unverified: "Unverified",
  user_confirmed: "Owner-confirmed",
  community_confirmed: "Community-confirmed",
  courier_verified: "Verified by a courier company",
  business_verified: "Verified business",
  organization_verified: "Verified organisation",
  official_verified: "Officially verified",
};

function verificationLabel(level: string, lang: Lang): string {
  if (lang === "ar") return VERIFICATION_LEVELS[level]?.ar ?? "غير موثق";
  return VERIFICATION_LABELS_EN[level] ?? "Unverified";
}

const ACCESSIBILITY_LABELS_EN: Record<string, string> = {
  wheelchair_accessible: "Wheelchair accessible",
  ramp: "Ramp",
  elevator: "Elevator",
  stairs: "Stairs",
  accessible_parking: "Accessible parking",
};

function accessibilityLabel(value: string, lang: Lang): string {
  return lang === "ar" ? (ACCESSIBILITY_LABELS[value] ?? value) : (ACCESSIBILITY_LABELS_EN[value] ?? value);
}

const CONFIDENCE_BAND_EN: Record<"high" | "medium" | "low", string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

function confidenceBandLabel(score: number, lang: Lang): string {
  const band = confidenceBand(score);
  return lang === "ar" ? band.ar : CONFIDENCE_BAND_EN[band.tone];
}

/** Minimal offline snapshot of the last successful resolution per code. */
type OfflineSnapshot = {
  code: string;
  purpose: string;
  site: string;
  area: string;
  entrance: { name: string; instructions: string | null; latitude: number | null; longitude: number | null } | null;
  cached_at: number;
};

function ResolverPage() {
  const { t, lang } = useI18n();
  const resolve = useServerFn(resolveAddress);
  const searchParams = Route.useSearch();
  const [code, setCode] = useState(() => normalizeCode(searchParams.code ?? "") || "SY-DAM-K7X4");
  const [purpose, setPurpose] = useState<Purpose>("parcel_delivery");
  const [wheelchair, setWheelchair] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const toggleFavFn = useServerFn(toggleFavorite);
  const listFavFn = useServerFn(listFavorites);
  const [signedIn, setSignedIn] = useState(false);
  const [favoriteCodes, setFavoriteCodes] = useState<Set<string>>(new Set());
  const [offlineCache, setOfflineCache] = useState<OfflineSnapshot | null>(null);

  const mutation = useMutation({
    mutationFn: (vars: { code: string; purpose: Purpose; wheelchair: boolean }) =>
      resolve({ data: { code: vars.code, purpose: vars.purpose, wheelchair: vars.wheelchair } }),
    onSuccess: (data) => {
      setOfflineCache(null);
      if (data.status === "ok") {
        try {
          localStorage.setItem(
            `san-cache:${data.code}`,
            JSON.stringify({
              code: data.code,
              purpose: data.purpose,
              site: data.site.display_name,
              area: [data.site.neighborhood, data.site.city].filter(Boolean).join(" — "),
              entrance: data.recommended
                ? {
                    name: data.recommended.display_name,
                    instructions: data.recommended.instructions,
                    latitude: data.recommended.latitude,
                    longitude: data.recommended.longitude,
                  }
                : null,
              cached_at: Date.now(),
            } satisfies OfflineSnapshot),
          );
        } catch {
          // storage unavailable — offline fallback just won't exist
        }
      }
    },
    onError: (_error, vars) => {
      try {
        const raw = localStorage.getItem(`san-cache:${normalizeCode(vars.code)}`);
        if (raw) setOfflineCache(JSON.parse(raw) as OfflineSnapshot);
      } catch {
        // no cached snapshot for this code
      }
    },
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const authed = Boolean(data.session);
      setSignedIn(authed);
      if (authed) {
        listFavFn({ data: undefined as never })
          .then((rows) => {
            const codes = rows
              .map((row) => row.smart_addresses?.code)
              .filter((value): value is string => Boolean(value));
            setFavoriteCodes(new Set(codes));
          })
          .catch(() => undefined);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mutation.mutate({ code, purpose, wheelchair });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose, wheelchair]);

  const result = mutation.data;
  const ok = result?.status === "ok" ? result : null;

  // Network layer: every public, active site with coordinates appears on the map.
  const networkQuery = useQuery({
    queryKey: ["network-pins"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("location_nodes")
        .select("id, display_name, latitude, longitude, smart_addresses(code, is_public, status)")
        .eq("is_active", true)
        .eq("visibility", "public")
        .in("node_type", ["property", "building", "warehouse", "farm", "factory", "hospital", "school", "hotel"])
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(500);
      return data ?? [];
    },
  });

  const pins: MapPin[] = ok
    ? [
        {
          id: ok.site.id,
          latitude: ok.site.latitude,
          longitude: ok.site.longitude,
          label: ok.site.display_name,
          tone: "site" as const,
          code: ok.code,
        },
        ...(ok.recommended
          ? [
              {
                id: ok.recommended.id,
                latitude: ok.recommended.latitude,
                longitude: ok.recommended.longitude,
                label: ok.recommended.display_name,
                tone: "recommended" as const,
                code: ok.code,
              },
            ]
          : []),
        ...ok.alternatives.map((a) => ({
          id: a.id,
          latitude: a.latitude,
          longitude: a.longitude,
          label: a.display_name,
          tone: "alternative" as const,
          code: ok.code,
        })),
      ]
    : [];

  const resolvedIds = new Set(pins.map((p) => p.id));
  const networkPins: MapPin[] = (networkQuery.data ?? [])
    .filter((node) => !resolvedIds.has(node.id))
    .map((node) => {
      const addresses = Array.isArray(node.smart_addresses)
        ? node.smart_addresses
        : node.smart_addresses
          ? [node.smart_addresses]
          : [];
      const active = addresses.find((a) => a?.is_public && a?.status === "active") ?? addresses[0];
      return {
        id: node.id,
        latitude: node.latitude,
        longitude: node.longitude,
        label: node.display_name,
        tone: "alternative" as const,
        code: active?.code ?? null,
      };
    });
  const allPins = [...pins, ...networkPins];

  /** Selecting a pin resolves its smart code in the side panel. */
  function handleSelectPin(pin: MapPin) {
    if (!pin.code) return;
    const next = normalizeCode(pin.code);
    setCode(next);
    mutation.mutate({ code: next, purpose, wheelchair });
  }


  const levels: SpineLevel[] =
    ok?.chain.map((node, index) => ({
      id: node.id,
      node_type: node.node_type,
      display_name: node.display_name,
      name_en: node.name_en,
      detail: node.description ?? null,
      code: index === 0 ? ok.code : null,
      emphasis: index === 0 ? ("site" as const) : ("muted" as const),
    })) ?? [];

  if (ok?.recommended) {
    levels.splice(1, 0, {
      id: ok.recommended.id,
      node_type: "entrance",
      display_name: ok.recommended.display_name,
      name_en: ok.recommended.name_en,
      detail: t({ ar: `الغرض: ${purposeLabel(purpose, "ar")}`, en: `Purpose: ${purposeLabel(purpose, "en")}` }),
      emphasis: "access",
    });
  }

  const band = ok ? confidenceBand(ok.confidence) : null;

  const mapCenter = ok
    ? {
        latitude: ok.recommended?.latitude ?? ok.site.latitude ?? 33.5138,
        longitude: ok.recommended?.longitude ?? ok.site.longitude ?? 36.2765,
      }
    : { latitude: 33.5138, longitude: 36.2765 };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground selection:bg-primary/20">
      <AppHeader />

      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        {/* Resolver panel (slim, side) */}
        <aside className="flex w-full flex-1 flex-col overflow-y-auto border-t border-border bg-surface md:flex-none md:border-t-0 md:border-s md:w-[420px]">
          <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-5 py-4 backdrop-blur-md">
            <h1 className="text-base font-bold leading-tight text-foreground">{t({ ar: "محلّل العنوان الذكي", en: "Smart Address Resolver" })}</h1>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground" dir="ltr">
              Smart Address Resolver
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate({ code: normalizeCode(code), purpose, wheelchair });
              }}
              className="relative mt-3"
            >
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                dir="ltr"
                aria-label={t({ ar: "العنوان الذكي", en: "Smart address" })}
                placeholder="SY-XXX-XXXX"
                className="w-full rounded-xl border-2 border-transparent bg-secondary py-3 pe-11 ps-4 font-mono text-base text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary focus:bg-surface"
              />
              <button
                type="submit"
                aria-label={t({ ar: "حلّل", en: "Resolve" })}
                className="absolute inset-y-0 start-2 my-auto flex h-9 items-center justify-center rounded-lg bg-primary px-2.5 text-primary-foreground"
              >
                <Search className="size-4" />
              </button>
            </form>

            <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
              {QUICK_PURPOSES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPurpose(value)}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    purpose === value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground"
                  }`}
                >
                  {purposeLabel(value, lang)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setWheelchair((v) => !v)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  wheelchair
                    ? "bg-foreground text-background"
                    : "border border-border bg-background text-muted-foreground"
                }`}
              >
                {t({ ar: "وصول كرسي متحرك", en: "Wheelchair access" })}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{t({ ar: "أمثلة:", en: "Examples:" })}</span>
              {DEMO_CODES.map((demo) => (
                <button
                  key={demo.code}
                  type="button"
                  onClick={() => {
                    setCode(demo.code);
                    mutation.mutate({ code: demo.code, purpose, wheelchair });
                  }}
                  title={t({ ar: demo.ar, en: demo.en })}
                  className="rounded-md border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-foreground"
                >
                  {demo.code}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 p-5">
            <section className="animate-entrance rounded-xl bg-foreground p-4 text-background">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary">{t({ ar: "إجراءات", en: "Actions" })}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/search"
                  className="flex items-center gap-1.5 rounded-lg border border-background/20 bg-background/5 px-3 py-2 text-sm font-bold"
                >
                  <Search className="size-4" /> {t({ ar: "بحث عن أعمال ومواقع", en: "Search businesses & places" })}
                </Link>
                <Link
                  to="/create"
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                >
                  <Timer className="size-4" /> {t({ ar: "إنشاء عنوان ذكي", en: "Create a smart address" })}
                </Link>
              </div>
              <p className="mt-3 flex items-start gap-2 text-[11px] opacity-70">
                <CircleCheck className="mt-0.5 size-3.5 shrink-0" />
                {t({
                  ar: "التصحيحات تمر بمراجعة ولا تستبدل المعلومات الموثقة تلقائياً.",
                  en: "Corrections go through review and never overwrite verified information automatically.",
                })}
              </p>
            </section>
            {mutation.isPending ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحليل…", en: "Resolving…" })}</p>
            ) : null}

            {result && result.status !== "ok" && !mutation.isPending ? (
              <section className="animate-entrance rounded-xl border border-border bg-background p-5 text-center">
                <p className="font-bold">
                  {result.status === "not_found"
                    ? t({ ar: "لا يوجد عنوان ذكي عام بهذا الرمز", en: "No public smart address matches this code" })
                    : result.status === "retired"
                      ? t({ ar: "هذا العنوان مُتقاعد ولم يُستبدل", en: "This address has been retired and not replaced" })
                      : t({ ar: "هذا العنوان خاص ولا يمكن حلّه علناً", en: "This address is private and can't be resolved publicly" })}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t({
                    ar: "العناوين السكنية خاصة افتراضياً. للوصول إليها يحتاج المُرسل رمزاً مؤقتاً من صاحب العنوان.",
                    en: "Residential addresses are private by default. Reaching one needs a temporary code from the address owner.",
                  })}
                </p>
              </section>
            ) : null}

            {mutation.isError && !offlineCache ? (
              <section className="animate-entrance rounded-xl border border-border bg-background p-5 text-center">
                <p className="font-bold">{t({ ar: "تعذر الاتصال بالخادم", en: "Couldn't reach the server" })}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t({
                    ar: "تحقق من الاتصال بالإنترنت ثم أعد المحاولة. الأكواد التي حللتها سابقاً تعمل دون اتصال.",
                    en: "Check your internet connection and try again. Codes you've already resolved keep working offline.",
                  })}
                </p>
              </section>
            ) : null}

            {mutation.isError && offlineCache ? (
              <section className="animate-entrance rounded-xl border border-primary/40 bg-background p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <WifiOff className="size-4" />
                  {t({ ar: "وضع عدم الاتصال — بيانات محفوظة من", en: "Offline mode — data saved on" })}{" "}
                  {new Date(offlineCache.cached_at).toLocaleDateString(lang === "ar" ? "ar-SY" : "en-GB")}
                </div>
                <p className="mt-3 text-sm font-bold">{offlineCache.site}</p>
                <p className="text-xs text-muted-foreground">{offlineCache.area}</p>
                {offlineCache.entrance ? (
                  <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm">
                    <p className="font-bold">{t({ ar: "المدخل:", en: "Entrance:" })} {offlineCache.entrance.name}</p>
                    {offlineCache.entrance.instructions ? (
                      <p className="mt-1 text-muted-foreground">{offlineCache.entrance.instructions}</p>
                    ) : null}
                    {offlineCache.entrance.latitude != null ? (
                      <p className="mt-1 font-mono text-[11px] text-primary" dir="ltr">
                        {formatCoords(offlineCache.entrance.latitude, offlineCache.entrance.longitude)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <p className="mt-3 rounded-lg bg-surface p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {t({ ar: "نص جاهز للرسائل:", en: "Ready-to-send text:" })} «{offlineCache.code} — {offlineCache.site}
                  {offlineCache.entrance ? `${t({ ar: "، المدخل:", en: ", entrance:" })} ${offlineCache.entrance.name}` : ""}»
                </p>
              </section>
            ) : null}

            {ok ? (
              <>
                {ok.recommended ? (
                  <section className="animate-entrance rounded-xl border border-border bg-background p-4 shadow-plate">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          {t({ ar: "نقطة الوصول الموصى بها", en: "Recommended access point" })} — {purposeLabel(purpose, lang)}
                        </span>
                        <h2 className="mt-0.5 text-lg font-bold leading-tight">{ok.recommended.display_name}</h2>
                        <p className="mt-1 font-mono text-xs text-primary" dir="ltr">
                          {formatCoords(ok.recommended.latitude, ok.recommended.longitude)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${
                          ok.recommended.open_now
                            ? "bg-allow-surface text-allow"
                            : "bg-prohibit-surface text-prohibit"
                        }`}
                      >
                        {ok.recommended.open_now ? t({ ar: "مفتوح الآن", en: "Open now" }) : t({ ar: "مغلق الآن", en: "Closed now" })}
                      </span>
                    </div>

                    {ok.recommended.instructions ? (
                      <p className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm">
                        {ok.recommended.instructions}
                      </p>
                    ) : null}

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-border bg-surface p-2">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                          <Clock className="size-3" /> {t({ ar: "ساعات العمل", en: "Hours" })}
                        </span>
                        <span className="mt-0.5 block font-mono" dir="ltr">
                          {ok.recommended.hours.always_open
                            ? "24/7"
                            : `${ok.recommended.hours.opens_at?.slice(0, 5) ?? "—"} – ${ok.recommended.hours.closes_at?.slice(0, 5) ?? "—"}`}
                        </span>
                      </div>
                      <div className="rounded-lg border border-border bg-surface p-2">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">{t({ ar: "التوثيق", en: "Verification" })}</span>
                        <span className="mt-0.5 block">
                          {verificationLabel(ok.recommended.verification_level, lang)}
                        </span>
                      </div>
                    </div>

                    {ok.recommended.accessibility.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {ok.recommended.accessibility.map((item) => (
                          <span
                            key={item}
                            className="rounded-md border border-border bg-surface px-2 py-0.5 text-[11px]"
                          >
                            {accessibilityLabel(item, lang)}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {ok.prohibited.length ? (
                      <div className="mt-3 space-y-1.5">
                        {ok.prohibited.map((item) => (
                          <p
                            key={item.display_name}
                            className="flex items-start gap-2 rounded-lg bg-prohibit-surface p-2 text-[12px] text-prohibit"
                          >
                            <Ban className="mt-0.5 size-3.5 shrink-0" />
                            <span>
                              <strong>{item.display_name}</strong> — {item.reason}
                            </span>
                          </p>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        to="/a/$code"
                        params={{ code: ok.code }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2.5 text-sm font-bold text-primary"
                      >
                        {t({ ar: "بطاقة العنوان الكاملة", en: "Full address card" })}
                      </Link>
                      <DirectionsButton
                        code={ok.code}
                        variant="solid"
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
                      />
                      <a
                        href={osmDirectionsUrl(ok.recommended.latitude, ok.recommended.longitude)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-bold"
                      >
                        <Navigation className="size-4" />
                        {t({ ar: "خرائط خارجية", en: "External maps" })}
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(ok.code);
                          toast.success(t({ ar: "تم نسخ العنوان الذكي", en: "Smart address copied" }));
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-bold"
                      >
                        <Copy className="size-4" />
                        {t({ ar: "نسخ", en: "Copy" })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowQr((v) => !v)}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-bold"
                      >
                        <QrCode className="size-4" />
                        {t({ ar: "رمز QR", en: "QR code" })}
                      </button>
                      {signedIn ? (
                        <button
                          type="button"
                          aria-label={
                            favoriteCodes.has(ok.code)
                              ? t({ ar: "إزالة من المفضلة", en: "Remove from favourites" })
                              : t({ ar: "حفظ في المفضلة", en: "Save to favourites" })
                          }
                          onClick={async () => {
                            try {
                              const res = await toggleFavFn({ data: { code: ok.code, label: ok.site.display_name } });
                              setFavoriteCodes((prev) => {
                                const next = new Set(prev);
                                if (res.saved) next.add(ok.code);
                                else next.delete(ok.code);
                                return next;
                              });
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
                            favoriteCodes.has(ok.code)
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border"
                          }`}
                        >
                          <Star
                            className="size-4"
                            fill={favoriteCodes.has(ok.code) ? "currentColor" : "none"}
                          />
                          {favoriteCodes.has(ok.code) ? t({ ar: "محفوظ", en: "Saved" }) : t({ ar: "حفظ", en: "Save" })}
                        </button>
                      ) : null}
                    </div>

                    {showQr ? (
                      <QrCard
                        url={
                          typeof window === "undefined"
                            ? `https://syriasan.com/a/${ok.code}`
                            : `${window.location.origin}/a/${ok.code}`
                        }
                        code={ok.code}
                        title={ok.site.display_name}
                        subtitle={[ok.site.neighborhood, ok.site.city].filter(Boolean).join(" — ")}
                        logoUrl={ok.business?.logo_url}
                        onClose={() => setShowQr(false)}
                      />
                    ) : null}
                  </section>
                ) : (
                  <section className="animate-entrance rounded-xl border border-prohibit/40 bg-prohibit-surface p-4">
                    <p className="font-bold text-prohibit">{t({ ar: "لا توجد نقطة وصول مسموحة لهذا الغرض", en: "No allowed access point for this purpose" })}</p>
                    <p className="mt-1 text-sm">
                      {t({
                        ar: `جميع المداخل المسجلة تمنع «${purposeLabel(purpose, "ar")}». تواصل مع إدارة الموقع أو أبلغ عن تصحيح.`,
                        en: `Every registered entrance prohibits "${purposeLabel(purpose, "en")}". Contact the site management or submit a correction.`,
                      })}
                    </p>
                  </section>
                )}

                <section className="animate-entrance rounded-xl border border-border bg-background p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {t({ ar: "التسلسل المكاني", en: "Spatial hierarchy" })}
                    </h2>
                    {band ? (
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${band.tone === "high" ? "bg-allow" : band.tone === "medium" ? "bg-primary" : "bg-prohibit"}`}
                        />
                        <span className="text-xs font-bold">
                          {verificationLabel(ok.verification_level, lang)} · {confidenceBandLabel(ok.confidence, lang)} ({ok.confidence}%)
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <HierarchySpine levels={levels} />
                  <p className="mt-5 text-xs text-muted-foreground">
                    {[ok.site.governorate, ok.site.city, ok.site.neighborhood, ok.site.street]
                      .filter(Boolean)
                      .join(" — ")}
                    {ok.site.landmark ? ` · ${ok.site.landmark}` : ""}
                  </p>
                </section>

                {ok.alternatives.length ? (
                  <section className="animate-entrance rounded-xl border border-border bg-background p-4">
                    <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <ArrowLeftRight className="size-3.5" />
                      {t({ ar: "نقاط وصول بديلة مسموحة", en: "Other allowed access points" })}
                    </h2>
                    <div className="space-y-2">
                      {ok.alternatives.map((alt) => (
                        <div
                          key={alt.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-bold">{alt.display_name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                              {formatCoords(alt.latitude, alt.longitude)}
                            </span>
                          </div>
                          <span
                            className={`text-[11px] font-bold ${alt.open_now ? "text-allow" : "text-prohibit"}`}
                          >
                            {alt.open_now ? t({ ar: "مفتوح", en: "Open" }) : t({ ar: "مغلق", en: "Closed" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <AddressFeedback
                  key={`${ok.code}-${purpose}`}
                  smartCode={ok.code}
                  purpose={purpose}
                  nodeId={ok.site.id}
                  accessPointId={ok.recommended?.id ?? null}
                  businessId={ok.business?.id ?? null}
                />
              </>
            ) : null}

            <p className="py-2 text-center text-[10px] text-muted-foreground">
              {t({
                ar: "العناوين السكنية خاصة افتراضياً. لا يتم كشف تفاصيل الوحدات أو أسماء السكان عبر البحث أو الـ API العام.",
                en: "Residential addresses are private by default. Unit details and resident names are never exposed through search or the public API.",
              })}
            </p>
          </div>
        </aside>

        {/* Map dominant area */}
        <main className="relative min-h-0 flex-1 bg-secondary">
          <CadastralMap
            fill
            center={mapCenter}
            pins={allPins}
            onSelectPin={handleSelectPin}

            className="h-[45vh] md:h-full"
          />
          {ok ? (
            <div className="pointer-events-none absolute top-3 end-3 flex items-center gap-2 rounded-lg border border-border bg-surface/95 px-3 py-1.5 shadow-plate backdrop-blur-md">
              <span className="size-2 rounded-full bg-primary" />
              <span className="font-mono text-xs font-bold tracking-wider" dir="ltr">
                {ok.code}
              </span>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
