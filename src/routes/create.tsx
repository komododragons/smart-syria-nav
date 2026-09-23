import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  LocateFixed,
  Navigation2,
  QrCode,
  Share2,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { LoopStepper } from "@/components/LoopStepper";
import { QrCardLazy as QrCard } from "@/components/QrCardLazy";
import { PLACE_CATEGORIES, placeCategoryLabel } from "@/lib/place-categories";
import { CadastralMap } from "@/components/CadastralMap";
import { supabase } from "@/integrations/supabase/client";
import { createSmartAddress, nearbySites } from "@/lib/addresses.functions";
import { useI18n } from "@/lib/i18n";
import {
  ACCESSIBILITY_LABELS,
  ACCESS_TYPES,
  GOVERNORATES,
  NODE_TYPES,
  PURPOSES,
  RESTRICTION_LABELS,
} from "@/lib/smart-address";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "إنشاء عنوان ذكي جديد" },
      {
        name: "description",
        content:
          "معالج من خمس خطوات لتسجيل موقع أو مبنى أو وحدة: الموقع، المدخل والأغراض المسموحة، الطابق والوحدة، ثم الخصوصية.",
      },
      { property: "og:title", content: "إنشاء عنوان ذكي — الشبكة السورية" },
      {
        property: "og:description",
        content: "سجّل مدخلاً واحداً أو عدة مداخل مع الأغراض المسموحة والممنوعة وساعات العمل.",
      },
    ],
  }),
  component: CreatePage,
});

type Intent = "home" | "business" | "office" | "shop" | "building" | "warehouse" | "farm" | "other";

const INTENTS: { value: Intent; ar: string; en: string; node_type: string; is_public: boolean }[] = [
  { value: "home", ar: "منزلي / شقتي", en: "Home / apartment", node_type: "building", is_public: false },
  { value: "shop", ar: "متجر أو صيدلية", en: "Shop or pharmacy", node_type: "building", is_public: true },
  { value: "business", ar: "منشأة أو عيادة", en: "Business or clinic", node_type: "building", is_public: true },
  { value: "office", ar: "مكتب في مبنى", en: "Office in a building", node_type: "building", is_public: true },
  { value: "building", ar: "مبنى كامل", en: "Entire building", node_type: "building", is_public: true },
  { value: "warehouse", ar: "مستودع أو مصنع", en: "Warehouse or factory", node_type: "warehouse", is_public: true },
  { value: "farm", ar: "مزرعة أو أرض", en: "Farm or land", node_type: "farm", is_public: true },
  { value: "other", ar: "غير ذلك", en: "Something else", node_type: "property", is_public: false },
];

const STEPS: { ar: string; en: string }[] = [
  { ar: "الغرض", en: "Purpose" },
  { ar: "الموقع", en: "Location" },
  { ar: "المدخل", en: "Entrance" },
  { ar: "الطابق والوحدة", en: "Floor & unit" },
  { ar: "الخصوصية", en: "Privacy" },
];

/** English labels for domain lookups that only carry Arabic in shared modules. */
const GOVERNORATE_EN: Record<string, string> = {
  DAM: "Damascus",
  RDA: "Damascus Countryside",
  ALE: "Aleppo",
  HOM: "Homs",
  HAM: "Hama",
  LAT: "Latakia",
  TAR: "Tartus",
  IDL: "Idlib",
  DAR: "Daraa",
  SUW: "As-Suwayda",
  QUN: "Quneitra",
  RAQ: "Raqqa",
  DEZ: "Deir ez-Zor",
  HAS: "Al-Hasakah",
};

const ACCESS_TYPE_EN: Record<string, string> = {
  entrance: "Entrance",
  gate: "Gate",
  delivery_point: "Delivery entrance",
  loading_dock: "Loading dock",
  service_entrance: "Service entrance",
  parking_entrance: "Parking entrance",
  emergency_entrance: "Emergency entrance",
  staff_entrance: "Staff entrance",
};

const RESTRICTION_EN: Record<string, string> = {
  no_deliveries: "No deliveries",
  residents_only: "Residents only",
  staff_only: "Staff only",
  closed_after_hours: "Closes after business hours",
  trucks_prohibited: "Trucks prohibited",
  pedestrian_only: "Pedestrians only",
  vehicle_only: "Vehicles only",
  emergency_only: "Emergency use only",
  temporary_closure: "Temporarily closed",
};

const ACCESSIBILITY_EN: Record<string, string> = {
  wheelchair_accessible: "Wheelchair accessible",
  ramp: "Ramp",
  elevator: "Elevator",
  stairs: "Stairs",
  accessible_parking: "Accessible parking",
};

function CreatePage() {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const create = useServerFn(createSmartAddress);
  const nearby = useServerFn(nearbySites);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<Intent>("home");
  const [coords, setCoords] = useState({ latitude: 33.5138, longitude: 36.2765 });
  const [governorateCode, setGovernorateCode] = useState("DAM");
  const [siteName, setSiteName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [street, setStreet] = useState("");
  const [landmark, setLandmark] = useState("");
  const [existingNodeId, setExistingNodeId] = useState<string | null>(null);
  const [nearbyList, setNearbyList] = useState<
    { id: string; display_name: string; distance_meters: number }[]
  >([]);

  const [addEntrance, setAddEntrance] = useState(true);
  const [accessType, setAccessType] = useState("main_entrance");
  const [entranceName, setEntranceName] = useState("المدخل الرئيسي");
  const [instructions, setInstructions] = useState("");
  const [accessibility, setAccessibility] = useState<string[]>([]);
  const [alwaysOpen, setAlwaysOpen] = useState(true);
  const [opensAt, setOpensAt] = useState("08:00");
  const [closesAt, setClosesAt] = useState("20:00");
  const [allowed, setAllowed] = useState<string[]>(["parcel_delivery", "visitor"]);
  const [prohibited, setProhibited] = useState<string[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);

  const [floorLabel, setFloorLabel] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [unitNote, setUnitNote] = useState("");

  const [isPublic, setIsPublic] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessPlaceCategory, setBusinessPlaceCategory] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  useEffect(() => {
    const preset = INTENTS.find((i) => i.value === intent);
    if (preset) setIsPublic(preset.is_public);
  }, [intent]);

  useEffect(() => {
    nearby({ data: { latitude: coords.latitude, longitude: coords.longitude, radius: 200 } })
      .then((rows) => setNearbyList(rows))
      .catch(() => setNearbyList([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.latitude, coords.longitude]);

  const mutation = useMutation({
    mutationFn: () => {
      const gov = GOVERNORATES.find((g) => g.code === governorateCode)!;
      const preset = INTENTS.find((i) => i.value === intent)!;
      return create({
        data: {
          intent,
          site: {
            existing_node_id: existingNodeId,
            node_type: preset.node_type,
            display_name: siteName || gov.ar,
            latitude: coords.latitude,
            longitude: coords.longitude,
            governorate_code: governorateCode,
            governorate: gov.ar,
            city: gov.ar,
            neighborhood: neighborhood || undefined,
            street: street || undefined,
            landmark: landmark || undefined,
          },
          access_point: addEntrance
            ? {
                existing_id: null,
                access_type: accessType,
                display_name: entranceName || "مدخل",
                latitude: coords.latitude,
                longitude: coords.longitude,
                instructions: instructions || undefined,
                accessibility,
                always_open: alwaysOpen,
                opens_at: alwaysOpen ? null : opensAt,
                closes_at: alwaysOpen ? null : closesAt,
                allowed_purposes: allowed,
                prohibited_purposes: prohibited,
                restrictions,
              }
            : null,
          floor: floorLabel ? { label: floorLabel, order: Number(floorLabel) || 0 } : null,
          unit: unitLabel
            ? {
                node_type: intent === "home" ? "apartment" : "unit",
                label: unitLabel,
                description: unitNote || undefined,
              }
            : null,
          is_public: isPublic,
          business:
            isPublic && businessName
              ? {
                  name_ar: businessName,
                  category: businessCategory || undefined,
                  place_category: businessPlaceCategory || undefined,
                  phone: businessPhone || undefined,
                }
              : null,
        },
      });
    },
    onSuccess: (result) => {
      toast.success(
        t({ ar: `تم إنشاء العنوان الذكي ${result.code}`, en: `Smart address ${result.code} created` }),
      );
      setCreatedCode(result.code);
      if (typeof window !== "undefined") window.scrollTo({ top: 0 });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : t({ ar: "تعذر الإنشاء", en: "Couldn't create the address" }),
      ),
  });

  if (createdCode) {
    const shareUrl =
      typeof window === "undefined" ? `/a/${createdCode}` : `${window.location.origin}/a/${createdCode}`;
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-xl space-y-4 px-4 py-8">
          <LoopStepper current="code" />
          <section className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t({ ar: "عنوانك الذكي جاهز", en: "Your smart address is ready" })}
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-widest">{createdCode}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              {t({
                ar: "الخطوة التالية: شارك الرمز أو رمز QR. من يستلمه يحلّه ويصل إلى المدخل الصحيح مباشرة.",
                en: "Next step: share the code or its QR. Whoever receives it resolves it and arrives at the right entrance.",
              })}
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(createdCode);
                  toast.success(t({ ar: "نُسخ الرمز", en: "Code copied" }));
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
              >
                <Copy className="size-4" /> {t({ ar: "نسخ الرمز", en: "Copy code" })}
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-bold"
              >
                <QrCode className="size-4" /> {t({ ar: "رمز QR ولوحة", en: "QR & plate" })}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    void navigator.share({ title: createdCode, url: shareUrl });
                  } else {
                    navigator.clipboard?.writeText(shareUrl);
                    toast.success(t({ ar: "نُسخ الرابط", en: "Link copied" }));
                  }
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-bold"
              >
                <Share2 className="size-4" /> {t({ ar: "مشاركة الرابط", en: "Share link" })}
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate({
                    to: "/navigation/$code",
                    params: { code: createdCode },
                    search: { ctx: undefined, token: undefined, mode: undefined },
                  })
                }
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-bold"
              >
                <Navigation2 className="size-4" /> {t({ ar: "جرّب التوجيه", en: "Test navigation" })}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-bold text-muted-foreground">
              <button type="button" onClick={() => navigate({ to: "/my-addresses" })}>
                {t({ ar: "عناويني", en: "My addresses" })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatedCode(null);
                  setStep(0);
                }}
              >
                {t({ ar: "إنشاء عنوان آخر", en: "Create another address" })}
              </button>
            </div>
          </section>
        </main>
        {qrOpen ? (
          <QrCard
            url={shareUrl}
            code={createdCode}
            title={siteName || createdCode}
            onClose={() => setQrOpen(false)}
          />
        ) : null}
      </div>
    );
  }

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign in required" })}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t({
              ar: "إنشاء عنوان ذكي مرتبط بحسابك حتى تتمكن من إدارة خصوصيته والعناوين المؤقتة.",
              en: "A smart address is tied to your account, so you can manage its privacy and any temporary addresses.",
            })}
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/create" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
          </button>
        </main>
      </div>
    );
  }

  function toggle(list: string[], setter: (v: string[]) => void, value: string) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <AppHeader />

      <nav aria-label={t({ ar: "خطوات إنشاء العنوان", en: "Address creation steps" })} className="border-b border-border bg-surface/70 px-4 py-3">
        <ol className="mx-auto flex max-w-3xl items-center gap-1.5">
          {STEPS.map((label, index) => (
            <li key={label.ar} aria-current={index === step ? "step" : undefined} className="flex flex-1 flex-col gap-1">
              <span
                className={`h-1 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`}
              />
              <span
                className={`text-[10px] ${index === step ? "font-bold text-foreground" : "text-muted-foreground"}`}
              >
                {t(label)}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {step === 0 ? (
          <section className="animate-entrance space-y-2">
            <h1 className="text-lg font-bold">{t({ ar: "ما الذي تسجّله؟", en: "What are you registering?" })}</h1>
            <p className="text-sm text-muted-foreground">
              {t({
                ar: "نستخدم هذا لتحديد عمق التسلسل: موقع، مبنى، طابق أو وحدة.",
                en: "This tells us how deep the hierarchy goes: a site, a building, a floor, or a unit.",
              })}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {INTENTS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setIntent(item.value)}
                  aria-pressed={intent === item.value}
                  className={`rounded-xl border p-4 text-start text-sm font-bold transition-colors ${
                    intent === item.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-surface text-muted-foreground"
                  }`}
                >
                  {t({ ar: item.ar, en: item.en })}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="animate-entrance space-y-3">
            <h1 className="text-lg font-bold">{t({ ar: "أين يقع بالضبط؟", en: "Where exactly is it?" })}</h1>
            <CadastralMap
              center={coords}
              pins={[
                {
                  id: "draft",
                  ...coords,
                  label: siteName || t({ ar: "الموقع", en: "Location" }),
                  tone: "draft",
                },
              ]}
              onPick={setCoords}
              onLocate={() => {
                navigator.geolocation?.getCurrentPosition(
                  (pos) =>
                    setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                  () => toast.error(t({ ar: "تعذر تحديد الموقع", en: "Couldn't detect your location" })),
                );
              }}
            />
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <LocateFixed className="size-3" />{" "}
              {t({ ar: "اضغط على المخطط لتحريك النقطة بدقة.", en: "Tap the map to place the pin precisely." })}
            </p>

            {nearbyList.length ? (
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t({
                    ar: "مواقع مسجلة قريبة — اربط بها لتجنّب التكرار",
                    en: "Nearby registered sites — link one to avoid duplicates",
                  })}
                </p>
                <div className="mt-2 space-y-1.5">
                  {nearbyList.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setExistingNodeId(existingNodeId === item.id ? null : item.id)
                      }
                      className={`flex w-full items-center justify-between rounded-lg border p-2 text-sm ${
                        existingNodeId === item.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background"
                      }`}
                    >
                      <span>{item.display_name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {t({ ar: `${item.distance_meters} م`, en: `${item.distance_meters} m` })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <select
                aria-label={t({ ar: "المحافظة", en: "Governorate" })}
                value={governorateCode}
                onChange={(event) => setGovernorateCode(event.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              >
                {GOVERNORATES.map((gov) => (
                  <option key={gov.code} value={gov.code}>
                    {t({ ar: gov.ar, en: GOVERNORATE_EN[gov.code] ?? gov.ar })}
                  </option>
                ))}
              </select>
              <input
                aria-label={t({ ar: "اسم المبنى أو الموقع", en: "Building or site name" })}
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
                placeholder={t({ ar: "اسم المبنى أو الموقع", en: "Building or site name" })}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
              <input
                aria-label={t({ ar: "الحي", en: "Neighborhood" })}
                value={neighborhood}
                onChange={(event) => setNeighborhood(event.target.value)}
                placeholder={t({ ar: "الحي", en: "Neighborhood" })}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
              <input
                aria-label={t({ ar: "الشارع", en: "Street" })}
                value={street}
                onChange={(event) => setStreet(event.target.value)}
                placeholder={t({ ar: "الشارع", en: "Street" })}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
              <input
                aria-label={t({ ar: "معلم قريب", en: "Nearby landmark" })}
                value={landmark}
                onChange={(event) => setLandmark(event.target.value)}
                placeholder={t({
                  ar: "معلم قريب (مثال: مقابل جامع الروضة)",
                  en: "Nearby landmark (e.g. across from Al-Rawda Mosque)",
                })}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="animate-entrance space-y-3">
            <h1 className="text-lg font-bold">{t({ ar: "المدخل والأغراض", en: "Entrance & purposes" })}</h1>
            <label className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-sm font-bold">
              {t({ ar: "تسجيل مدخل لهذا الموقع", en: "Register an entrance for this site" })}
              <input
                type="checkbox"
                checked={addEntrance}
                onChange={(event) => setAddEntrance(event.target.checked)}
                className="size-4 accent-current"
              />
            </label>

            {addEntrance ? (
              <>
                <div className="grid gap-2">
                  <select
                    aria-label={t({ ar: "نوع المدخل", en: "Entrance type" })}
                    value={accessType}
                    onChange={(event) => setAccessType(event.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                  >
                    {ACCESS_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {t({ ar: type.ar, en: ACCESS_TYPE_EN[type.value] ?? type.ar })}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={t({ ar: "اسم المدخل", en: "Entrance name" })}
                    value={entranceName}
                    onChange={(event) => setEntranceName(event.target.value)}
                    placeholder={t({
                      ar: "اسم المدخل (مثال: المدخل A — الزوار)",
                      en: "Entrance name (e.g. Entrance A — Visitors)",
                    })}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                  />
                  <textarea
                    aria-label={t({ ar: "تعليمات الوصول", en: "Access instructions" })}
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    rows={3}
                    placeholder={t({
                      ar: "تعليمات الوصول: البوابة الحديدية السوداء، الجرس الثاني…",
                      en: "Access instructions: the black iron gate, second doorbell…",
                    })}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t({ ar: "أغراض مسموحة", en: "Allowed purposes" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PURPOSES.map((purpose) => (
                      <button
                        key={purpose.value}
                        type="button"
                        onClick={() => toggle(allowed, setAllowed, purpose.value)}
                        aria-pressed={allowed.includes(purpose.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          allowed.includes(purpose.value)
                            ? "bg-allow-surface text-allow"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {t({ ar: purpose.ar, en: purpose.en })}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t({ ar: "أغراض ممنوعة", en: "Prohibited purposes" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PURPOSES.map((purpose) => (
                      <button
                        key={purpose.value}
                        type="button"
                        onClick={() => toggle(prohibited, setProhibited, purpose.value)}
                        aria-pressed={prohibited.includes(purpose.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          prohibited.includes(purpose.value)
                            ? "bg-prohibit-surface text-prohibit"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {t({ ar: purpose.ar, en: purpose.en })}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t({ ar: "قيود", en: "Restrictions" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(RESTRICTION_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggle(restrictions, setRestrictions, value)}
                        aria-pressed={restrictions.includes(value)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          restrictions.includes(value)
                            ? "bg-foreground text-background"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {t({ ar: label, en: RESTRICTION_EN[value] ?? label })}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t({ ar: "إمكانية الوصول", en: "Accessibility" })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(ACCESSIBILITY_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggle(accessibility, setAccessibility, value)}
                        aria-pressed={accessibility.includes(value)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          accessibility.includes(value)
                            ? "bg-foreground text-background"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {t({ ar: label, en: ACCESSIBILITY_EN[value] ?? label })}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-3">
                  <label className="flex items-center justify-between text-sm font-bold">
                    {t({ ar: "مفتوح 24/7", en: "Open 24/7" })}
                    <input
                      type="checkbox"
                      checked={alwaysOpen}
                      onChange={(event) => setAlwaysOpen(event.target.checked)}
                      className="size-4"
                    />
                  </label>
                  {!alwaysOpen ? (
                    <div className="mt-3 grid grid-cols-2 gap-2" dir="ltr">
                      <input
                        type="time"
                        aria-label={t({ ar: "وقت الفتح", en: "Opening time" })}
                        value={opensAt}
                        onChange={(event) => setOpensAt(event.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
                      />
                      <input
                        type="time"
                        aria-label={t({ ar: "وقت الإغلاق", en: "Closing time" })}
                        value={closesAt}
                        onChange={(event) => setClosesAt(event.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
                      />
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {step === 3 ? (
          <section className="animate-entrance space-y-3">
            <h1 className="text-lg font-bold">{t({ ar: "الطابق والوحدة", en: "Floor & unit" })}</h1>
            <p className="text-sm text-muted-foreground">
              {t({
                ar: "اتركها فارغة إن كان العنوان يشير إلى الموقع أو المبنى كاملاً.",
                en: "Leave these blank if the address refers to the whole site or building.",
              })}
            </p>
            <input
              aria-label={t({ ar: "الطابق", en: "Floor" })}
              value={floorLabel}
              onChange={(event) => setFloorLabel(event.target.value)}
              placeholder={t({ ar: "الطابق (مثال: 3 أو أرضي)", en: "Floor (e.g. 3 or ground)" })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
            />
            <input
              aria-label={t({ ar: "الوحدة أو الشقة", en: "Unit or apartment" })}
              value={unitLabel}
              onChange={(event) => setUnitLabel(event.target.value)}
              placeholder={t({ ar: "الوحدة / الشقة (مثال: 12)", en: "Unit / apartment (e.g. 12)" })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
            />
            <textarea
              aria-label={t({ ar: "ملاحظة داخلية", en: "Internal note" })}
              value={unitNote}
              onChange={(event) => setUnitNote(event.target.value)}
              rows={2}
              placeholder={t({
                ar: "ملاحظة داخلية (تظهر فقط لمن تشاركه العنوان)",
                en: "Internal note (visible only to people you share the address with)",
              })}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
            />
          </section>
        ) : null}

        {step === 4 ? (
          <section className="animate-entrance space-y-3">
            <h1 className="text-lg font-bold">{t({ ar: "الخصوصية والنشر", en: "Privacy & publishing" })}</h1>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                aria-pressed={!isPublic}
                className={`w-full rounded-xl border p-4 text-start ${
                  !isPublic ? "border-primary bg-primary/5" : "border-border bg-surface"
                }`}
              >
                <p className="text-sm font-bold">{t({ ar: "خاص (موصى به للسكني)", en: "Private (recommended for homes)" })}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t({
                    ar: "لا يظهر في البحث ولا يُحلّ عبر الـ API العام. تشارك الوصول عبر عنوان مؤقت ينتهي تلقائياً.",
                    en: "Won't appear in search or resolve through the public API. Share access with a temporary address that expires automatically.",
                  })}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                aria-pressed={isPublic}
                className={`w-full rounded-xl border p-4 text-start ${
                  isPublic ? "border-primary bg-primary/5" : "border-border bg-surface"
                }`}
              >
                <p className="text-sm font-bold">{t({ ar: "عام", en: "Public" })}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t({
                    ar: "مناسب للأعمال والمرافق: يظهر في البحث ويُحلّ للجميع حسب الغرض.",
                    en: "Suited to businesses and facilities: appears in search and resolves for everyone, per purpose.",
                  })}
                </p>
              </button>
            </div>

            {isPublic ? (
              <div className="grid gap-2 rounded-xl border border-border bg-surface p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  {t({ ar: "بطاقة العمل (اختياري)", en: "Business card (optional)" })}
                </p>
                <input
                  aria-label={t({ ar: "اسم النشاط", en: "Business name" })}
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder={t({ ar: "اسم النشاط", en: "Business name" })}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
                <input
                  aria-label={t({ ar: "تصنيف النشاط", en: "Business category" })}
                  value={businessCategory}
                  onChange={(event) => setBusinessCategory(event.target.value)}
                  placeholder={t({ ar: "التصنيف (صيدلية، مطعم…)", en: "Category (pharmacy, restaurant…)" })}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
                <select
                  aria-label={t({ ar: "تصنيف الدليل العام", en: "Public directory category" })}
                  value={businessPlaceCategory}
                  onChange={(event) => setBusinessPlaceCategory(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                >
                  <option value="">{t({ ar: "تصنيف الدليل العام (اختياري)", en: "Public directory category (optional)" })}</option>
                  {PLACE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.emoji} {placeCategoryLabel(c.value, lang)}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={t({ ar: "هاتف النشاط", en: "Business phone" })}
                  value={businessPhone}
                  dir="ltr"
                  onChange={(event) => setBusinessPhone(event.target.value)}
                  placeholder="+963…"
                  className="rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm"
                />
              </div>
            ) : null}

            <p className="rounded-xl bg-secondary p-3 text-[11px] text-muted-foreground">
              {t({
                ar: "العنوان الجديد يبدأ بمستوى توثيق «مؤكد من المستخدم» وثقة 60%. يرتفع بعد تأكيدات التسليم أو التوثيق البلدي.",
                en: "New addresses start at the \"user-confirmed\" verification level with 60% confidence. It rises after delivery confirmations or municipal verification.",
              })}
            </p>
          </section>
        ) : null}
      </main>

      <div className="fixed bottom-0 inset-x-0 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-bold"
            >
              <ArrowRight className="size-4" /> {t({ ar: "السابق", en: "Back" })}
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 py-3 text-sm font-bold text-background"
            >
              {t({ ar: "التالي", en: "Next" })} <ArrowLeft className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Check className="size-4" />
              {mutation.isPending
                ? t({ ar: "جارٍ الإنشاء…", en: "Creating…" })
                : t({ ar: "إنشاء العنوان الذكي", en: "Create smart address" })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
