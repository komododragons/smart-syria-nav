import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
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
  Timer,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { AppHeader } from "@/components/AppHeader";
import { AddressFeedback } from "@/components/AddressFeedback";
import { QrCard } from "@/components/QrCard";
import { CadastralMap, type MapPin } from "@/components/CadastralMap";
import { HierarchySpine, type SpineLevel } from "@/components/HierarchySpine";
import { resolveAddress } from "@/lib/addresses.functions";
import {
  ACCESSIBILITY_LABELS,
  PURPOSE_LABELS,
  QUICK_PURPOSES,
  VERIFICATION_LEVELS,
  confidenceBand,
  formatCoords,
  normalizeCode,
  osmDirectionsUrl,
  type Purpose,
} from "@/lib/smart-address";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
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
    ],
  }),
  component: ResolverPage,
});

const DEMO_CODES = [
  { code: "SY-DAM-K7X4", ar: "برج سكني — دمشق" },
  { code: "SY-DAM-9M4Q", ar: "مركز طبي — المزة" },
  { code: "SY-RDA-82KF", ar: "مستودع — عدرا" },
];

function ResolverPage() {
  const resolve = useServerFn(resolveAddress);
  const searchParams = Route.useSearch();
  const [code, setCode] = useState(() => normalizeCode(searchParams.code ?? "") || "SY-DAM-K7X4");
  const [purpose, setPurpose] = useState<Purpose>("parcel_delivery");
  const [wheelchair, setWheelchair] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const mutation = useMutation({
    mutationFn: (vars: { code: string; purpose: Purpose; wheelchair: boolean }) =>
      resolve({ data: { code: vars.code, purpose: vars.purpose, wheelchair: vars.wheelchair } }),
  });

  useEffect(() => {
    mutation.mutate({ code, purpose, wheelchair });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purpose, wheelchair]);

  const result = mutation.data;
  const ok = result?.status === "ok" ? result : null;

  const pins: MapPin[] = ok
    ? [
        {
          id: ok.site.id,
          latitude: ok.site.latitude,
          longitude: ok.site.longitude,
          label: ok.site.display_name,
          tone: "site" as const,
        },
        ...(ok.recommended
          ? [
              {
                id: ok.recommended.id,
                latitude: ok.recommended.latitude,
                longitude: ok.recommended.longitude,
                label: ok.recommended.display_name,
                tone: "recommended" as const,
              },
            ]
          : []),
        ...ok.alternatives.map((a) => ({
          id: a.id,
          latitude: a.latitude,
          longitude: a.longitude,
          label: a.display_name,
          tone: "alternative" as const,
        })),
      ]
    : [];

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
      detail: `الغرض: ${PURPOSE_LABELS[purpose] ?? purpose}`,
      emphasis: "access",
    });
  }

  const band = ok ? confidenceBand(ok.confidence) : null;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20">
      <AppHeader />

      <div className="border-b border-border bg-surface/70 px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate({ code: normalizeCode(code), purpose, wheelchair });
            }}
            className="relative"
          >
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              dir="ltr"
              aria-label="العنوان الذكي"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-lg transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              className="absolute inset-y-0 end-2 my-auto flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-bold text-background"
            >
              <Search className="size-3.5" />
              حلّل
            </button>
          </form>

          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {QUICK_PURPOSES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPurpose(value)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  purpose === value
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background text-muted-foreground"
                }`}
              >
                {PURPOSE_LABELS[value]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setWheelchair((v) => !v)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                wheelchair
                  ? "bg-foreground text-background"
                  : "border border-border bg-background text-muted-foreground"
              }`}
            >
              وصول كرسي متحرك
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>أمثلة:</span>
            {DEMO_CODES.map((demo) => (
              <button
                key={demo.code}
                type="button"
                onClick={() => {
                  setCode(demo.code);
                  mutation.mutate({ code: demo.code, purpose, wheelchair });
                }}
                className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[11px] text-foreground"
              >
                {demo.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {mutation.isPending ? (
          <p className="py-16 text-center text-sm text-muted-foreground">جارٍ التحليل…</p>
        ) : null}

        {result && result.status !== "ok" && !mutation.isPending ? (
          <section className="animate-entrance rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="font-bold">
              {result.status === "not_found"
                ? "لا يوجد عنوان ذكي عام بهذا الرمز"
                : result.status === "retired"
                  ? "هذا العنوان مُتقاعد ولم يُستبدل"
                  : "هذا العنوان خاص ولا يمكن حلّه علناً"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              العناوين السكنية خاصة افتراضياً. للوصول إليها يحتاج المُرسل رمزاً مؤقتاً من صاحب العنوان.
            </p>
          </section>
        ) : null}

        {ok ? (
          <>
            <section className="animate-entrance">
              <CadastralMap
                center={{
                  latitude: ok.recommended?.latitude ?? ok.site.latitude ?? 33.5138,
                  longitude: ok.recommended?.longitude ?? ok.site.longitude ?? 36.2765,
                }}
                pins={pins}
              />
            </section>

            {ok.recommended ? (
              <section className="animate-entrance rounded-2xl border border-border bg-surface p-5 shadow-plate">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      نقطة الوصول الموصى بها — {PURPOSE_LABELS[purpose]}
                    </span>
                    <h1 className="text-xl font-bold leading-tight">{ok.recommended.display_name}</h1>
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
                    {ok.recommended.open_now ? "مفتوح الآن" : "مغلق الآن"}
                  </span>
                </div>

                {ok.recommended.instructions ? (
                  <p className="mt-3 rounded-lg border border-border bg-background p-3 text-sm">
                    {ok.recommended.instructions}
                  </p>
                ) : null}

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-border bg-background p-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground">
                      <Clock className="size-3" /> ساعات العمل
                    </span>
                    <span className="mt-0.5 block font-mono" dir="ltr">
                      {ok.recommended.hours.always_open
                        ? "24/7"
                        : `${ok.recommended.hours.opens_at?.slice(0, 5) ?? "—"} – ${ok.recommended.hours.closes_at?.slice(0, 5) ?? "—"}`}
                    </span>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-2">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">التوثيق</span>
                    <span className="mt-0.5 block">
                      {VERIFICATION_LEVELS[ok.recommended.verification_level]?.ar ?? "غير موثق"}
                    </span>
                  </div>
                </div>

                {ok.recommended.accessibility.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ok.recommended.accessibility.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px]"
                      >
                        {ACCESSIBILITY_LABELS[item] ?? item}
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
                  <a
                    href={osmDirectionsUrl(ok.recommended.latitude, ok.recommended.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
                  >
                    <Navigation className="size-4" />
                    الاتجاهات
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(ok.code);
                      toast.success("تم نسخ العنوان الذكي");
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-bold"
                  >
                    <Copy className="size-4" />
                    نسخ
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQr((v) => !v)}
                    className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-bold"
                  >
                    <QrCode className="size-4" />
                    رمز QR
                  </button>
                </div>

                {showQr ? (
                  <QrCard
                    url={
                      typeof window === "undefined"
                        ? `https://smartaddress.sy/?code=${ok.code}`
                        : `${window.location.origin}/?code=${ok.code}`
                    }
                    code={ok.code}
                    title={ok.site.display_name}
                    subtitle={[ok.site.neighborhood, ok.site.city].filter(Boolean).join(" — ")}
                    onClose={() => setShowQr(false)}
                  />
                ) : null}
              </section>
            ) : (
              <section className="animate-entrance rounded-2xl border border-prohibit/40 bg-prohibit-surface p-5">
                <p className="font-bold text-prohibit">لا توجد نقطة وصول مسموحة لهذا الغرض</p>
                <p className="mt-1 text-sm">
                  جميع المداخل المسجلة تمنع «{PURPOSE_LABELS[purpose]}». تواصل مع إدارة الموقع أو أبلغ عن تصحيح.
                </p>
              </section>
            )}

            <section className="animate-entrance rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  التسلسل المكاني
                </h2>
                {band ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${band.tone === "high" ? "bg-allow" : band.tone === "medium" ? "bg-primary" : "bg-prohibit"}`}
                    />
                    <span className="text-xs font-bold">
                      {VERIFICATION_LEVELS[ok.verification_level]?.ar ?? "غير موثق"} · {band.ar} ({ok.confidence}%)
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
              <section className="animate-entrance rounded-2xl border border-border bg-surface p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  <ArrowLeftRight className="size-3.5" />
                  نقاط وصول بديلة مسموحة
                </h2>
                <div className="space-y-2">
                  {ok.alternatives.map((alt) => (
                    <div
                      key={alt.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
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
                        {alt.open_now ? "مفتوح" : "مغلق"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="animate-entrance rounded-2xl bg-foreground p-5 text-background">
              <h2 className="text-xs font-bold uppercase tracking-widest text-primary">إجراءات</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to="/search"
                  className="flex items-center gap-1.5 rounded-lg border border-background/20 bg-background/5 px-3 py-2 text-sm font-bold"
                >
                  <Search className="size-4" /> بحث عن أعمال ومواقع
                </Link>
                <Link
                  to="/create"
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                >
                  <Timer className="size-4" /> إنشاء عنوان ذكي
                </Link>
              </div>
              <p className="mt-4 flex items-start gap-2 text-[11px] opacity-70">
                <CircleCheck className="mt-0.5 size-3.5 shrink-0" />
                التصحيحات تمر بمراجعة ولا تستبدل المعلومات الموثقة تلقائياً.
              </p>
            </section>

            <AddressFeedback
              key={`${ok.code}-${purpose}`}
              smartCode={ok.code}
              purpose={purpose}
              nodeId={ok.site.id}
              accessPointId={ok.recommended?.id ?? null}
            />
          </>
        ) : null}

        <p className="px-6 py-4 text-center text-[10px] text-muted-foreground">
          العناوين السكنية خاصة افتراضياً. لا يتم كشف تفاصيل الوحدات أو أسماء السكان عبر البحث أو الـ API العام.
        </p>
      </main>
    </div>
  );
}
