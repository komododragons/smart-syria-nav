import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Accessibility,
  ArrowUpFromLine,
  BadgeCheck,
  Building2,
  DoorOpen,
  Layers,
  MapPin,
  Package,
  ParkingSquare,
  Phone,
  ShieldAlert,
  Truck,
} from "lucide-react";

import { CadastralMap, type MapPin as Pin } from "@/components/CadastralMap";
import { DirectionsButton } from "@/components/DirectionsButton";
import { resolveAddress } from "@/lib/addresses.functions";
import { logAddressEvent } from "@/lib/orgs.functions";
import { normalizeCode, VERIFICATION_LEVELS } from "@/lib/smart-address";

export const Route = createFileRoute("/d/$code")({
  loader: ({ params }) =>
    resolveAddress({ data: { code: params.code, purpose: "parcel_delivery" } }),
  head: ({ params }) => ({
    meta: [
      { title: `${normalizeCode(params.code)} — وضع التوصيل | سيرياسان` },
      {
        name: "description",
        content:
          "عرض توصيل مبسّط للعنوان الذكي: المدخل، نقطة التوقف، المواقف، الطابق والمعلم مع زر توجيه كبير — بدون بيانات شخصية.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: `وضع التوصيل ${normalizeCode(params.code)}` },
      {
        property: "og:description",
        content: "المعلومات اللازمة لإتمام التوصيل فقط — المدخل، التوقف، المواقف والتوجيه.",
      },
      { property: "og:type", content: "place" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <Shell>
      <p className="text-center text-lg font-bold">تعذر تحميل عنوان التوصيل</p>
      <p className="mt-2 text-center text-sm text-muted-foreground">أعد المحاولة بعد قليل.</p>
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <p className="text-center text-lg font-bold">لا يوجد عنوان بهذا الرمز</p>
    </Shell>
  ),
  component: DeliveryPage,
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

/** Large, high-readability info row — the core of delivery mode. */
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
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-surface"
      }`}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-background">
        <Icon className="size-5 text-primary" />
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

function DeliveryPage() {
  const result = Route.useLoaderData();
  const { code: rawCode } = Route.useParams();
  const ok = result.status === "ok" ? result : null;

  useEffect(() => {
    if (!ok) return;
    void logAddressEvent({
      data: { code: normalizeCode(rawCode), event: "delivery_view", source: "courier" },
    }).catch(() => undefined);
  }, [ok, rawCode]);

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
          العناوين السكنية خاصة افتراضياً — يحتاج الساعي رابطاً مؤقتاً من صاحب العنوان.
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
  const unit = ok.chain.find((n) => n.unit_label);
  const floor = ok.chain.find((n) => n.floor_label);
  const building = ok.chain.find((n) => n.node_type === "building");
  const lat = ap?.latitude ?? ok.site.latitude;
  const lng = ap?.longitude ?? ok.site.longitude;
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

  // Delivery-only data: no personal names, no owner data. A contact action is
  // only shown for a public business phone (explicitly published). Recipient
  // contact for private addresses requires an authorized share link (Phase 5).
  const contactPhone = ok.business?.phone ?? null;

  const vehicleApproach = ap?.vehicle_access
    ? "وصول مركبات حتى المدخل"
    : ap && !ap.vehicle_access
      ? "توقّف بالمركبة خارجاً — أكمل مشياً"
      : null;

  return (
    <div className="min-h-screen bg-secondary">
      {/* Slim header — code + destination, readable at a glance */}
      <header className="border-b border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block font-mono text-sm font-bold tracking-widest text-primary" dir="ltr">
              {ok.code}
            </span>
            <h1 className="truncate text-base font-bold">{ok.site.display_name}</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {[ok.site.neighborhood, ok.site.city, ok.site.governorate].filter(Boolean).join(" — ")}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-surface px-2 py-1 text-[10px] font-bold">
            <BadgeCheck className="size-3.5 text-primary" />
            {VERIFICATION_LEVELS[ok.verification_level]?.ar ?? "غير موثق"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-3 p-4">
        {/* Map, compact */}
        <div className="overflow-hidden rounded-2xl border border-border">
          <CadastralMap
            fill
            center={{ latitude: lat ?? 33.5138, longitude: lng ?? 36.2765 }}
            pins={pins}
            className="h-44"
          />
        </div>

        {/* Primary action: huge navigate button */}
        <DirectionsButton
          code={ok.code}
          mode="delivery"
          label="ابدأ التوجيه إلى المدخل"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-lg font-bold text-primary-foreground shadow-plate"
        />

        {/* Delivery-relevant facts only */}
        <div className="space-y-2">
          <BigRow icon={Truck} label="أفضل وصول للمركبة" value={vehicleApproach} />
          <BigRow
            icon={DoorOpen}
            label="مدخل المبنى"
            value={ap?.display_name ?? null}
            highlight
          />
          <BigRow
            icon={ArrowUpFromLine}
            label="نقطة التوقف / التحميل"
            value={ap?.loading_info ?? ok.site.loading_info}
          />
          <BigRow
            icon={ParkingSquare}
            label="المواقف"
            value={ap?.parking_info ?? ok.site.parking_info}
          />
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
          {/* Unit only when the recipient shared it publicly via the address */}
          <BigRow icon={Layers} label="الوحدة / الشقة" value={unit?.unit_label ?? null} />
          <BigRow
            icon={Accessibility}
            label="المصعد"
            value={ok.site.has_elevator ? "يوجد مصعد" : null}
          />
          <BigRow icon={MapPin} label="أقرب معلم" value={ok.site.landmark} />
        </div>

        {ap?.instructions ? (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
              تعليمات التوصيل
            </span>
            <p className="mt-1 text-base font-bold leading-snug">{ap.instructions}</p>
          </div>
        ) : null}

        {ok.restrictions.length ? (
          <div className="space-y-1.5">
            {ok.restrictions.map((r) => (
              <p
                key={r}
                className="flex items-start gap-2 rounded-xl bg-surface p-3 text-sm text-muted-foreground"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                {r}
              </p>
            ))}
          </div>
        ) : null}

        {/* Contact action — only when explicitly published (business phone) */}
        {contactPhone ? (
          <a
            href={`tel:${contactPhone}`}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-4 text-lg font-bold text-primary"
          >
            <Phone className="size-5" />
            اتصل بـ {ok.business?.name_ar ?? "المستلم"}
          </a>
        ) : (
          <p className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center text-xs text-muted-foreground">
            <ShieldAlert className="size-3.5 shrink-0" />
            بيانات المستلم الشخصية لا تُعرض في وضع التوصيل.
          </p>
        )}

        <Link
          to="/a/$code"
          params={{ code: ok.code }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold"
        >
          <Package className="size-4" />
          عرض بطاقة العنوان الكاملة
        </Link>
      </main>
    </div>
  );
}
