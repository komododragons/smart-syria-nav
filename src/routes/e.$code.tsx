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
import { type Lang, useI18n } from "@/lib/i18n";
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
      <ErrorBody />
    </Shell>
  ),
  notFoundComponent: () => (
    <Shell>
      <NotFoundBody />
    </Shell>
  ),
  component: EmergencyPage,
});

function ErrorBody() {
  const { t } = useI18n();
  return (
    <>
      <p className="text-center text-lg font-bold">
        {t({ ar: "تعذر تحميل بطاقة الطوارئ", en: "We couldn't load the emergency card" })}
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

/** Plain-text emergency summary — dispatch-friendly, one message, in the active language. */
function buildEmergencyText(
  lang: Lang,
  t: (v: { ar: string; en: string }) => string,
  ok: NonNullable<ReturnType<typeof Route.useLoaderData>> & { status: "ok" },
  building: ReturnType<typeof Route.useLoaderData> extends never ? never : { display_name: string } | undefined,
  emergencyEntrance: { display_name: string } | null,
  ap: { display_name: string; instructions?: string | null } | null | undefined,
  floor: { floor_label?: string | null } | undefined,
  vehicleApproach: string | null,
  coords: string | null,
  accessNotes: string[],
): string {
  return [
    `${t({ ar: "عنوان طوارئ سيرياسان", en: "Syriasan emergency address" })}: ${ok.code}`,
    ok.site.display_name,
    [ok.site.neighborhood, ok.site.city, ok.site.governorate].filter(Boolean).join(lang === "ar" ? " - " : ", "),
    ok.site.street ? `${t({ ar: "الشارع", en: "Street" })}: ${ok.site.street}` : null,
    building || ok.site.building_number
      ? `${t({ ar: "المبنى", en: "Building" })}: ${building?.display_name ?? ""}${
          ok.site.building_number ? ` ${t({ ar: "رقم", en: "No." })} ${ok.site.building_number}` : ""
        }`.trim()
      : null,
    emergencyEntrance
      ? `${t({ ar: "مدخل الطوارئ", en: "Emergency entrance" })}: ${emergencyEntrance.display_name}`
      : null,
    ap ? `${t({ ar: "المدخل الموصى به", en: "Recommended entrance" })}: ${ap.display_name}` : null,
    floor?.floor_label ? `${t({ ar: "الطابق", en: "Floor" })}: ${floor.floor_label}` : null,
    vehicleApproach ? `${t({ ar: "وصول المركبات", en: "Vehicle access" })}: ${vehicleApproach}` : null,
    ok.site.has_elevator != null
      ? `${t({ ar: "المصعد", en: "Elevator" })}: ${
          ok.site.has_elevator ? t({ ar: "متوفر", en: "Available" }) : t({ ar: "غير متوفر", en: "Not available" })
        }`
      : null,
    ok.site.wheelchair_accessible != null
      ? `${t({ ar: "وصول الكراسي المتحركة", en: "Wheelchair access" })}: ${
          ok.site.wheelchair_accessible
            ? t({ ar: "متاح", en: "Available" })
            : t({ ar: "غير متاح", en: "Not available" })
        }`
      : null,
    ok.site.landmark ? `${t({ ar: "أقرب معلم", en: "Nearest landmark" })}: ${ok.site.landmark}` : null,
    coords ? `${t({ ar: "الإحداثيات", en: "Coordinates" })}: ${coords}` : null,
    accessNotes.length
      ? `${t({ ar: "ملاحظات الوصول", en: "Access notes" })}: ${accessNotes.join(" | ")}`
      : null,
    typeof window !== "undefined" ? `${window.location.origin}/e/${ok.code}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function EmergencyPage() {
  const { t, lang } = useI18n();
  const result = Route.useLoaderData();
  const { code: rawCode } = Route.useParams();
  const ok = result.status === "ok" ? result : null;
  const [copied, setCopied] = useState(false);

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
            ar: "العناوين السكنية خاصة افتراضياً — يلزم رابط مؤقت من صاحب العنوان لعرض تفاصيله.",
            en: "Residential addresses are private by default — a temporary link from the owner is needed to view details.",
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
    ? t({ ar: "وصول المركبات حتى المدخل", en: "Vehicle access right to the entrance" })
    : ap
      ? t({
          ar: "لا وصول للمركبات حتى المدخل — التوقف خارجاً وإكمال الطريق مشياً",
          en: "No vehicle access to the entrance — park outside and continue on foot",
        })
      : null;

  const accessNotes = [
    ap?.instructions,
    ok.site.public_notes,
    ...ok.restrictions,
  ].filter((v): v is string => Boolean(v));

  const emergencyText = buildEmergencyText(
    lang,
    t,
    ok as NonNullable<ReturnType<typeof Route.useLoaderData>> & { status: "ok" },
    building,
    emergencyEntrance,
    ap,
    floor,
    vehicleApproach,
    coords,
    accessNotes,
  );

  const verificationLabel = t({
    ar: VERIFICATION_LEVELS[ok.verification_level]?.ar ?? "غير موثق",
    en: VERIFICATION_LABELS_EN[ok.verification_level] ?? "Unverified",
  });

  return (
    <div className="min-h-screen bg-secondary">
      <header className="border-b-2 border-destructive/40 bg-destructive/10 px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive">
              <Siren className="size-3.5" />
              {t({ ar: "وضع الطوارئ", en: "Emergency mode" })}
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
            {verificationLabel}
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
              toast.success(t({ ar: "تم نسخ الإحداثيات", en: "Coordinates copied" }));
            }}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-start"
          >
            <span className="min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {t({ ar: "الإحداثيات", en: "Coordinates" })}
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
          label={t({ ar: "ابدأ التوجيه إلى الموقع", en: "Start directions to the location" })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-4 text-lg font-bold text-destructive-foreground shadow-plate"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(emergencyText);
              setCopied(true);
              toast.success(t({ ar: "تم نسخ بطاقة الطوارئ", en: "Emergency card copied" }));
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 px-3 py-3.5 text-sm font-bold text-destructive"
          >
            <Copy className="size-4" />
            {copied
              ? t({ ar: "تم النسخ", en: "Copied" })
              : t({ ar: "نسخ عنوان الطوارئ", en: "Copy emergency address" })}
          </button>
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}/e/${ok.code}`;
              if (typeof navigator !== "undefined" && navigator.share) {
                try {
                  await navigator.share({
                    title: `${t({ ar: "طوارئ", en: "Emergency" })} ${ok.code}`,
                    text: emergencyText,
                    url,
                  });
                  return;
                } catch {
                  // share sheet dismissed — fall back to copying
                }
              }
              await navigator.clipboard.writeText(`${emergencyText}`);
              toast.success(t({ ar: "تم نسخ موقع الطوارئ", en: "Emergency location copied" }));
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-3.5 text-sm font-bold"
          >
            <Share2 className="size-4" />
            {t({ ar: "مشاركة موقع الطوارئ", en: "Share emergency location" })}
          </button>
        </div>

        <div className="space-y-2">
          <BigRow
            icon={LifeBuoy}
            label={t({ ar: "مدخل الطوارئ", en: "Emergency entrance" })}
            value={emergencyEntrance?.display_name ?? null}
            highlight
          />
          <BigRow
            icon={Truck}
            label={t({ ar: "أفضل وصول معروف للمركبات", en: "Best known vehicle access" })}
            value={vehicleApproach}
            highlight={!emergencyEntrance}
          />
          <BigRow
            icon={DoorOpen}
            label={t({ ar: "المدخل الموصى به", en: "Recommended entrance" })}
            value={ap?.display_name ?? null}
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
          <BigRow
            icon={ArrowUpFromLine}
            label={t({ ar: "المصعد", en: "Elevator" })}
            value={
              ok.site.has_elevator == null
                ? null
                : ok.site.has_elevator
                  ? t({ ar: "متوفر", en: "Available" })
                  : t({ ar: "غير متوفر — الدرج فقط", en: "Not available — stairs only" })
            }
          />
          <BigRow
            icon={Accessibility}
            label={t({ ar: "وصول الكراسي المتحركة", en: "Wheelchair access" })}
            value={
              ok.site.wheelchair_accessible == null
                ? null
                : ok.site.wheelchair_accessible
                  ? t({ ar: "متاح", en: "Available" })
                  : t({ ar: "غير متاح", en: "Not available" })
            }
          />
          <BigRow
            icon={ArrowUpFromLine}
            label={t({ ar: "نقطة التوقف / التحميل", en: "Stopping / loading point" })}
            value={ap?.loading_info ?? ok.site.loading_info}
          />
          <BigRow icon={MapPin} label={t({ ar: "أقرب معلم", en: "Nearest landmark" })} value={ok.site.landmark} />
        </div>

        {accessNotes.length ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-destructive">
              <ShieldAlert className="size-3.5" />
              {t({ ar: "ملاحظات الوصول", en: "Access notes" })}
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
          {t({
            ar: "هذه بطاقة معلومات وصول من سيرياسان، وليست خدمة استدعاء إسعاف أو دفاع مدني، ولا ترتبط حالياً بأي جهة رسمية. اتصل بأرقام الطوارئ المعتمدة مباشرة، ويمكنك إرسال هذه البطاقة إليهم لتسهيل الوصول. البنية جاهزة للربط المستقبلي بأنظمة الإسعاف والدفاع المدني عند وجود اتفاق مؤسسي فعلي.",
            en: "This is a Syriasan access-information card, not an ambulance or civil-defense dispatch service, and it isn't currently linked to any official agency. Call your local emergency numbers directly, and feel free to forward this card to them to make the trip easier. The platform is built to connect with ambulance and civil-defense systems in the future, once a real institutional agreement is in place.",
          })}
        </p>

        <Link
          to="/a/$code"
          params={{ code: ok.code }}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold"
        >
          <Navigation className="size-4" />
          {t({ ar: "عرض بطاقة العنوان الكاملة", en: "View the full address card" })}
        </Link>
      </main>
    </div>
  );
}
