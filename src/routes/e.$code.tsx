import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Accessibility,
  AlertTriangle,
  ArrowUpFromLine,
  BadgeCheck,
  Building2,
  Copy,
  DoorOpen,
  Layers,
  LifeBuoy,
  MapPin,
  Navigation,
  Share2,
  ShieldAlert,
  Siren,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { CadastralMap, type MapPin as Pin } from "@/components/CadastralMap";
import { DirectionsButton } from "@/components/DirectionsButton";
import { resolveAddress } from "@/lib/addresses.functions";
import { normalizeCode, VERIFICATION_LEVELS } from "@/lib/smart-address";

export const Route = createFileRoute("/e/$code")({
  loader: ({ params }) => resolveAddress({ data: { code: params.code, purpose: "emergency" } }),
  head: ({ params }) => ({
    meta: [
      { title: `${normalizeCode(params.code)} — وضع الطوارئ | سيرياسان` },
      {
        name: "description",
        content:
          "بطاقة طوارئ للعنوان الذكي: الإحداثيات، المبنى، مدخل الطوارئ، أفضل وصول للمركبات، المصعد وإمكانية الوصول — للنسخ والمشاركة السريعة.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `وضع الطوارئ ${normalizeCode(params.code)}` },
      {
        property: "og:description",
        content: "معلومات الوصول الطارئ لهذا العنوان الذكي.",
      },
      { property: "og:type", content: "place" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <Shell>
      <p className="text-center text-lg font-bold">تعذر تحميل بطاقة الطوارئ</p>
      <p className="mt-2 text-center text-sm text-muted-foreground">أعد المحاولة بعد قليل.</p>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="text-center text-lg font-bold">لا يوجد عنوان بهذا الرمز</p>
    </Shell>
  ),
  component: EmergencyPage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary p-4">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-border bg-background p-6">{children}</div>
      </div>
    </div>
  );
}

function BigRow({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof MapPin;
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-4 ${
        highlight ? "border-destructive/40 bg-destructive/5" : "border-border bg-surface"
      }`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-background">
        <Icon className={`size-5 ${highlight ? "text-destructive" : "text-primary"}`} />
      </span>
      <div className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block break-words text-base font-bold leading-snug">{value}</span>
      </div>
    </div>
  );
}

function EmergencyPage() {
  const result = Route.useLoaderData();
  const { code: rawCode } = Route.useParams();
  const ok = result.status === "ok" ? result : null;
  const [copied, setCopied] = useState(false);

  if (!ok) {
    return (
      <Shell>
        <p className="text-center text-lg font-bold">
          {result.status === "not_found"
            ? "لا يوجد عنوان ذكي عام بهذا الرمز"
            : result.status === "retired"
              ? "هذا الرمز مُتقاعد"
              : "هذا العنوان خاص ولا يمكن عرضه علناً"}
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          العناوين السكنية خاصة افتراضياً — يلزم رابط مؤقت من صاحب العنوان لعرض تفاصيله.
        </p>
        <p className="mt-4 text-center font-mono text-xs text-muted-foreground" dir="ltr">
          {normalizeCode(rawCode)}
        </p>
        <Link to="/" className="mt-5 block text-center text-sm font-bold text-primary">
          العودة إلى البحث
        </Link>
      </Shell>
    );
  }

  const ap = ok.recommended;
  const emergencyEntrance =
    [ap, ...ok.alternatives].find(
      (candidate) => candidate && candidate.access_type === "emergency_entrance",
    ) ?? null;
  const floor = ok.chain.find((n) => n.floor_label);
  const building = ok.chain.find((n) => n.node_type === "building");
  const lat = ap?.latitude ?? ok.site.latitude;
  const lng = ap?.longitude ?? ok.site.longitude;
  const coords = lat != null && lng != null ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : null;

  const pins: Pin[] =
    lat != null && lng != null
      ? [
          {
            id: ok.code,
            latitude: lat,
            longitude: lng,
            label: ok.site.display_name,
            tone: "recommended" as const,
          },
        ]
      : [];

  const vehicleApproach = ap?.vehicle_access
    ? "وصول المركبات حتى المدخل"
    : ap
      ? "لا وصول للمركبات حتى المدخل — التوقف خارجاً وإكمال الطريق مشياً"
      : null;

  const accessNotes = [
    ap?.instructions,
    ok.site.public_notes,
    ...ok.restrictions,
  ].filter((v): v is string => Boolean(v));

  /** Plain-text emergency summary — dispatch-friendly, one message. */
  const emergencyText = [
    `عنوان طوارئ سيرياسان: ${ok.code}`,
    ok.site.display_name,
    [ok.site.neighborhood, ok.site.city, ok.site.governorate].filter(Boolean).join(" - "),
    ok.site.street ? `الشارع: ${ok.site.street}` : null,
    building || ok.site.building_number
      ? `المبنى: ${building?.display_name ?? ""}${ok.site.building_number ? ` رقم ${ok.site.building_number}` : ""}`.trim()
      : null,
    emergencyEntrance ? `مدخل الطوارئ: ${emergencyEntrance.display_name}` : null,
    ap ? `المدخل الموصى به: ${ap.display_name}` : null,
    floor?.floor_label ? `الطابق: ${floor.floor_label}` : null,
    vehicleApproach ? `وصول المركبات: ${vehicleApproach}` : null,
    ok.site.has_elevator != null ? `المصعد: ${ok.site.has_elevator ? "متوفر" : "غير متوفر"}` : null,
    ok.site.wheelchair_accessible != null
      ? `وصول الكراسي المتحركة: ${ok.site.wheelchair_accessible ? "متاح" : "غير متاح"}`
      : null,
    ok.site.landmark ? `أقرب معلم: ${ok.site.landmark}` : null,
    coords ? `الإحداثيات: ${coords}` : null,
    accessNotes.length ? `ملاحظات الوصول: ${accessNotes.join(" | ")}` : null,
    typeof window !== "undefined" ? `${window.location.origin}/e/${ok.code}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b-2 border-destructive/40 bg-destructive/10 px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive">
              <Siren className="size-3.5" />
              وضع الطوارئ
            </span>
            <span className="mt-0.5 block font-mono text-sm font-bold tracking-widest" dir="ltr">
              {ok.code}
            </span>
            <h1 className="truncate text-base font-bold">{ok.site.display_name}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {[ok.site.neighborhood, ok.site.city, ok.site.governorate].filter(Boolean).join(" — ")}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-background px-2 py-1 text-[10px] font-bold">
            <BadgeCheck className="size-3.5 text-primary" />
            {VERIFICATION_LEVELS[ok.verification_level]?.ar ?? "غير موثق"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 p-4">
        <div className="overflow-hidden rounded-2xl border border-border">
          <CadastralMap
            fill
            center={{ latitude: lat ?? 33.5138, longitude: lng ?? 36.2765 }}
            pins={pins}
            className="h-44"
          />
        </div>

        {coords ? (
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(coords);
              toast.success("تم نسخ الإحداثيات");
            }}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-start"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                الإحداثيات
              </span>
              <span className="mt-0.5 block font-mono text-base font-bold" dir="ltr">
                {coords}
              </span>
            </span>
            <Copy className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ) : null}

        <DirectionsButton
          code={ok.code}
          mode="driving"
          label="ابدأ التوجيه إلى الموقع"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-4 text-lg font-bold text-destructive-foreground shadow-plate"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(emergencyText);
              setCopied(true);
              toast.success("تم نسخ بطاقة الطوارئ");
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 px-3 py-3.5 text-sm font-bold text-destructive"
          >
            <Copy className="size-4" />
            {copied ? "تم النسخ" : "نسخ عنوان الطوارئ"}
          </button>
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/e/${ok.code}`;
              if (typeof navigator !== "undefined" && navigator.share) {
                try {
                  await navigator.share({ title: `طوارئ ${ok.code}`, text: emergencyText, url });
                  return;
                } catch {
                  // share sheet dismissed — fall back to copying
                }
              }
              await navigator.clipboard.writeText(`${emergencyText}`);
              toast.success("تم نسخ موقع الطوارئ");
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-3.5 text-sm font-bold"
          >
            <Share2 className="size-4" />
            مشاركة موقع الطوارئ
          </button>
        </div>

        <div className="space-y-2">
          <BigRow
            icon={LifeBuoy}
            label="مدخل الطوارئ"
            value={emergencyEntrance?.display_name ?? null}
            highlight
          />
          <BigRow
            icon={Truck}
            label="أفضل وصول معروف للمركبات"
            value={vehicleApproach}
            highlight={!emergencyEntrance}
          />
          <BigRow icon={DoorOpen} label="المدخل الموصى به" value={ap?.display_name ?? null} />
          <BigRow
            icon={Building2}
            label="المبنى"
            value={
              building
                ? `${building.display_name}${ok.site.building_number ? ` · رقم ${ok.site.building_number}` : ""}`
                : ok.site.building_number
                  ? `رقم ${ok.site.building_number}`
                  : null
            }
          />
          <BigRow icon={Layers} label="الطابق" value={floor?.floor_label ?? null} />
          <BigRow
            icon={ArrowUpFromLine}
            label="المصعد"
            value={
              ok.site.has_elevator == null
                ? null
                : ok.site.has_elevator
                  ? "متوفر"
                  : "غير متوفر — الدرج فقط"
            }
          />
          <BigRow
            icon={Accessibility}
            label="وصول الكراسي المتحركة"
            value={
              ok.site.wheelchair_accessible == null
                ? null
                : ok.site.wheelchair_accessible
                  ? "متاح"
                  : "غير متاح"
            }
          />
          <BigRow
            icon={ArrowUpFromLine}
            label="نقطة التوقف / التحميل"
            value={ap?.loading_info ?? ok.site.loading_info}
          />
          <BigRow icon={MapPin} label="أقرب معلم" value={ok.site.landmark} />
        </div>

        {accessNotes.length ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive">
              <ShieldAlert className="size-3.5" />
              ملاحظات الوصول
            </span>
            <ul className="mt-1.5 space-y-1">
              {accessNotes.map((note) => (
                <li key={note} className="text-sm font-bold leading-snug">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* No official emergency-service integration exists — say so plainly. */}
        <p className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-[11px] leading-relaxed text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          هذه بطاقة معلومات وصول من سيرياسان، وليست خدمة استدعاء إسعاف أو دفاع مدني، ولا ترتبط حالياً
          بأي جهة رسمية. اتصل بأرقام الطوارئ المعتمدة مباشرة، ويمكنك إرسال هذه البطاقة إليهم لتسهيل
          الوصول. البنية جاهزة للربط المستقبلي بأنظمة الإسعاف والدفاع المدني عند وجود اتفاق مؤسسي فعلي.
        </p>

        <Link
          to="/a/$code"
          params={{ code: ok.code }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold"
        >
          <Navigation className="size-4" />
          عرض بطاقة العنوان الكاملة
        </Link>
      </main>
    </div>
  );
}
