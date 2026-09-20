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
import { useI18n } from "@/lib/i18n";
import { logAddressEvent } from "@/lib/orgs.functions";
import { normalizeCode, VERIFICATION_LEVELS } from "@/lib/smart-address";

const VERIFICATION_LABELS_EN: Record<string, string> = {
  unverified: "Unverified",
  user_confirmed: "Confirmed by owner",
  community_confirmed: "Community confirmed",
  courier_verified: "Verified by courier company",
  business_verified: "Verified business",
  organization_verified: "Verified organization",
  official_verified: "Officially verified",
};

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
      <ErrorBody />
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <NotFoundBody />
    </Shell>
  ),
  component: DeliveryPage,
});

function ErrorBody() {
  const { t } = useI18n();
  return (
    <>
      <p className="text-center text-lg font-bold">
        {t({ ar: "تعذر تحميل عنوان التوصيل", en: "We couldn't load this delivery address" })}
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {t({ ar: "أعد المحاولة بعد قليل.", en: "Please try again in a moment." })}
      </p>
    </>
  );
}

function NotFoundBody() {
  const { t } = useI18n();
  return (
    <p className="text-center text-lg font-bold">
      {t({ ar: "لا يوجد عنوان بهذا الرمز", en: "No address matches this code" })}
    </p>
  );
}

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
  const { t, name } = useI18n();
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
            ? t({ ar: "لا يوجد عنوان ذكي عام بهذا الرمز", en: "No public smart address matches this code" })
            : result.status === "retired"
              ? t({ ar: "هذا الرمز مُتقاعد", en: "This code has been retired" })
              : t({ ar: "هذا العنوان خاص ولا يمكن عرضه علناً", en: "This address is private and can't be shown publicly" })}
        </p>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t({
            ar: "العناوين السكنية خاصة افتراضياً — يحتاج الساعي رابطاً مؤقتاً من صاحب العنوان.",
            en: "Residential addresses are private by default — the courier needs a temporary link from the address owner.",
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
    ? t({ ar: "وصول مركبات حتى المدخل", en: "Vehicle access right to the entrance" })
    : ap && !ap.vehicle_access
      ? t({ ar: "توقّف بالمركبة خارجاً — أكمل مشياً", en: "Park outside — continue on foot" })
      : null;

  const verificationLabel =
    t({ ar: VERIFICATION_LEVELS[ok.verification_level]?.ar ?? "غير موثق", en: VERIFICATION_LABELS_EN[ok.verification_level] ?? "Unverified" });

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
            {verificationLabel}
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
          label={t({ ar: "ابدأ التوجيه إلى المدخل", en: "Start directions to the entrance" })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-lg font-bold text-primary-foreground shadow-plate"
        />

        {/* Delivery-relevant facts only */}
        <div className="space-y-2">
          <BigRow
            icon={Truck}
            label={t({ ar: "أفضل وصول للمركبة", en: "Best vehicle access" })}
            value={vehicleApproach}
          />
          <BigRow
            icon={DoorOpen}
            label={t({ ar: "مدخل المبنى", en: "Building entrance" })}
            value={ap?.display_name ?? null}
            highlight
          />
          <BigRow
            icon={ArrowUpFromLine}
            label={t({ ar: "نقطة التوقف / التحميل", en: "Stopping / loading point" })}
            value={ap?.loading_info ?? ok.site.loading_info}
          />
          <BigRow
            icon={ParkingSquare}
            label={t({ ar: "المواقف", en: "Parking" })}
            value={ap?.parking_info ?? ok.site.parking_info}
          />
          <BigRow
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
          <BigRow icon={Layers} label={t({ ar: "الطابق", en: "Floor" })} value={floor?.floor_label ?? null} />
          {/* Unit only when the recipient shared it publicly via the address */}
          <BigRow
            icon={Layers}
            label={t({ ar: "الوحدة / الشقة", en: "Unit / apartment" })}
            value={unit?.unit_label ?? null}
          />
          <BigRow
            icon={Accessibility}
            label={t({ ar: "المصعد", en: "Elevator" })}
            value={ok.site.has_elevator ? t({ ar: "يوجد مصعد", en: "Elevator available" }) : null}
          />
          <BigRow icon={MapPin} label={t({ ar: "أقرب معلم", en: "Nearest landmark" })} value={ok.site.landmark} />
        </div>

        {ap?.instructions ? (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-primary">
              {t({ ar: "تعليمات التوصيل", en: "Delivery instructions" })}
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
            {t({ ar: "اتصل بـ", en: "Call" })}{" "}
            {ok.business ? name(ok.business) : t({ ar: "المستلم", en: "the recipient" })}
          </a>
        ) : (
          <p className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center text-xs text-muted-foreground">
            <ShieldAlert className="size-3.5 shrink-0" />
            {t({
              ar: "بيانات المستلم الشخصية لا تُعرض في وضع التوصيل.",
              en: "The recipient's personal details aren't shown in delivery mode.",
            })}
          </p>
        )}

        <Link
          to="/a/$code"
          params={{ code: ok.code }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold"
        >
          <Package className="size-4" />
          {t({ ar: "عرض بطاقة العنوان الكاملة", en: "View the full address card" })}
        </Link>
      </main>
    </div>
  );
}
