import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, LocateFixed } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PLACE_CATEGORIES } from "@/lib/place-categories";
import { CadastralMap } from "@/components/CadastralMap";
import { supabase } from "@/integrations/supabase/client";
import { createSmartAddress, nearbySites } from "@/lib/addresses.functions";
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

const INTENTS: { value: Intent; ar: string; node_type: string; is_public: boolean }[] = [
  { value: "home", ar: "منزلي / شقتي", node_type: "building", is_public: false },
  { value: "shop", ar: "متجر أو صيدلية", node_type: "building", is_public: true },
  { value: "business", ar: "منشأة أو عيادة", node_type: "building", is_public: true },
  { value: "office", ar: "مكتب في مبنى", node_type: "building", is_public: true },
  { value: "building", ar: "مبنى كامل", node_type: "building", is_public: true },
  { value: "warehouse", ar: "مستودع أو مصنع", node_type: "warehouse", is_public: true },
  { value: "farm", ar: "مزرعة أو أرض", node_type: "farm", is_public: true },
  { value: "other", ar: "غير ذلك", node_type: "property", is_public: false },
];

const STEPS = ["الغرض", "الموقع", "المدخل", "الطابق والوحدة", "الخصوصية"];

function CreatePage() {
  const navigate = useNavigate();
  const create = useServerFn(createSmartAddress);
  const nearby = useServerFn(nearbySites);

  const [authed, setAuthed] = useState<boolean | null>(null);
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
      toast.success(`تم إنشاء العنوان الذكي ${result.code}`);
      navigate({ to: "/my-addresses" });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذر الإنشاء"),
  });

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">يلزم تسجيل الدخول</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            إنشاء عنوان ذكي مرتبط بحسابك حتى تتمكن من إدارة خصوصيته والعناوين المؤقتة.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/create" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            الدخول
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

      <div className="border-b border-border bg-surface/70 px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-1.5">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 flex-col gap-1">
              <span
                className={`h-1 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`}
              />
              <span
                className={`text-[10px] ${index === step ? "font-bold text-foreground" : "text-muted-foreground"}`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {step === 0 ? (
          <section className="animate-entrance space-y-2">
            <h1 className="text-lg font-bold">ما الذي تسجّله؟</h1>
            <p className="text-sm text-muted-foreground">
              نستخدم هذا لتحديد عمق التسلسل: موقع، مبنى، طابق أو وحدة.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {INTENTS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setIntent(item.value)}
                  className={`rounded-xl border p-4 text-start text-sm font-bold transition-colors ${
                    intent === item.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-surface text-muted-foreground"
                  }`}
                >
                  {item.ar}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="animate-entrance space-y-3">
            <h1 className="text-lg font-bold">أين يقع بالضبط؟</h1>
            <CadastralMap
              center={coords}
              pins={[{ id: "draft", ...coords, label: siteName || "الموقع", tone: "draft" }]}
              onPick={setCoords}
              onLocate={() => {
                navigator.geolocation?.getCurrentPosition(
                  (pos) =>
                    setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
                  () => toast.error("تعذر تحديد الموقع"),
                );
              }}
            />
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <LocateFixed className="size-3" /> اضغط على المخطط لتحريك النقطة بدقة.
            </p>

            {nearbyList.length ? (
              <div className="rounded-xl border border-border bg-surface p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  مواقع مسجلة قريبة — اربط بها لتجنّب التكرار
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
                        {item.distance_meters} م
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <select
                value={governorateCode}
                onChange={(event) => setGovernorateCode(event.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              >
                {GOVERNORATES.map((gov) => (
                  <option key={gov.code} value={gov.code}>
                    {gov.ar}
                  </option>
                ))}
              </select>
              <input
                value={siteName}
                onChange={(event) => setSiteName(event.target.value)}
                placeholder="اسم المبنى أو الموقع"
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
              <input
                value={neighborhood}
                onChange={(event) => setNeighborhood(event.target.value)}
                placeholder="الحي"
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
              <input
                value={street}
                onChange={(event) => setStreet(event.target.value)}
                placeholder="الشارع"
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
              <input
                value={landmark}
                onChange={(event) => setLandmark(event.target.value)}
                placeholder="معلم قريب (مثال: مقابل جامع الروضة)"
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
              />
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="animate-entrance space-y-3">
            <h1 className="text-lg font-bold">المدخل والأغراض</h1>
            <label className="flex items-center justify-between rounded-xl border border-border bg-surface p-3 text-sm font-bold">
              تسجيل مدخل لهذا الموقع
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
                    value={accessType}
                    onChange={(event) => setAccessType(event.target.value)}
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                  >
                    {ACCESS_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.ar}
                      </option>
                    ))}
                  </select>
                  <input
                    value={entranceName}
                    onChange={(event) => setEntranceName(event.target.value)}
                    placeholder="اسم المدخل (مثال: المدخل A — الزوار)"
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                  />
                  <textarea
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    rows={3}
                    placeholder="تعليمات الوصول: البوابة الحديدية السوداء، الجرس الثاني…"
                    className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
                  />
                </div>

                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    أغراض مسموحة
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PURPOSES.map((purpose) => (
                      <button
                        key={purpose.value}
                        type="button"
                        onClick={() => toggle(allowed, setAllowed, purpose.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          allowed.includes(purpose.value)
                            ? "bg-allow-surface text-allow"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {purpose.ar}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    أغراض ممنوعة
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {PURPOSES.map((purpose) => (
                      <button
                        key={purpose.value}
                        type="button"
                        onClick={() => toggle(prohibited, setProhibited, purpose.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          prohibited.includes(purpose.value)
                            ? "bg-prohibit-surface text-prohibit"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {purpose.ar}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    قيود
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(RESTRICTION_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggle(restrictions, setRestrictions, value)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          restrictions.includes(value)
                            ? "bg-foreground text-background"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    إمكانية الوصول
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(ACCESSIBILITY_LABELS).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggle(accessibility, setAccessibility, value)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          accessibility.includes(value)
                            ? "bg-foreground text-background"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface p-3">
                  <label className="flex items-center justify-between text-sm font-bold">
                    مفتوح 24/7
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
                        value={opensAt}
                        onChange={(event) => setOpensAt(event.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
                      />
                      <input
                        type="time"
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
            <h1 className="text-lg font-bold">الطابق والوحدة</h1>
            <p className="text-sm text-muted-foreground">
              اتركها فارغة إن كان العنوان يشير إلى الموقع أو المبنى كاملاً.
            </p>
            <input
              value={floorLabel}
              onChange={(event) => setFloorLabel(event.target.value)}
              placeholder="الطابق (مثال: 3 أو أرضي)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
            />
            <input
              value={unitLabel}
              onChange={(event) => setUnitLabel(event.target.value)}
              placeholder="الوحدة / الشقة (مثال: 12)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
            />
            <textarea
              value={unitNote}
              onChange={(event) => setUnitNote(event.target.value)}
              rows={2}
              placeholder="ملاحظة داخلية (تظهر فقط لمن تشاركه العنوان)"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
            />
          </section>
        ) : null}

        {step === 4 ? (
          <section className="animate-entrance space-y-3">
            <h1 className="text-lg font-bold">الخصوصية والنشر</h1>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`w-full rounded-xl border p-4 text-start ${
                  !isPublic ? "border-primary bg-primary/5" : "border-border bg-surface"
                }`}
              >
                <p className="text-sm font-bold">خاص (موصى به للسكني)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  لا يظهر في البحث ولا يُحلّ عبر الـ API العام. تشارك الوصول عبر عنوان مؤقت ينتهي تلقائياً.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`w-full rounded-xl border p-4 text-start ${
                  isPublic ? "border-primary bg-primary/5" : "border-border bg-surface"
                }`}
              >
                <p className="text-sm font-bold">عام</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  مناسب للأعمال والمرافق: يظهر في البحث ويُحلّ للجميع حسب الغرض.
                </p>
              </button>
            </div>

            {isPublic ? (
              <div className="grid gap-2 rounded-xl border border-border bg-surface p-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  بطاقة العمل (اختياري)
                </p>
                <input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder="اسم النشاط"
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
                <input
                  value={businessCategory}
                  onChange={(event) => setBusinessCategory(event.target.value)}
                  placeholder="التصنيف (صيدلية، مطعم…)"
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                />
                <select
                  value={businessPlaceCategory}
                  onChange={(event) => setBusinessPlaceCategory(event.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                >
                  <option value="">تصنيف الدليل العام (اختياري)</option>
                  {PLACE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.emoji} {c.ar}
                    </option>
                  ))}
                </select>
                <input
                  value={businessPhone}
                  dir="ltr"
                  onChange={(event) => setBusinessPhone(event.target.value)}
                  placeholder="+963…"
                  className="rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm"
                />
              </div>
            ) : null}

            <p className="rounded-xl bg-secondary p-3 text-[11px] text-muted-foreground">
              العنوان الجديد يبدأ بمستوى توثيق «مؤكد من المستخدم» وثقة 60%. يرتفع بعد تأكيدات
              التسليم أو التوثيق البلدي.
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
              <ArrowRight className="size-4" /> السابق
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 py-3 text-sm font-bold text-background"
            >
              التالي <ArrowLeft className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              <Check className="size-4" />
              {mutation.isPending ? "جارٍ الإنشاء…" : "إنشاء العنوان الذكي"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
