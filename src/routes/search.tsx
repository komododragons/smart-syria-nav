import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Building2, Landmark, Navigation2, Search as SearchIcon, Store } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { DirectionsButton } from "@/components/DirectionsButton";
import { useI18n, formatDistance, type Lang } from "@/lib/i18n";
import { searchNetwork } from "@/lib/addresses.functions";
import { PLACE_CATEGORIES, placeCategoryLabel } from "@/lib/place-categories";
import { GOVERNORATES, NODE_TYPE_LABELS, VERIFICATION_LEVELS } from "@/lib/smart-address";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "البحث في شبكة العنوان الذكي" },
      {
        name: "description",
        content:
          "ابحث عن الأعمال والمواقع والمعالم في سوريا بالعربية أو الإنجليزية، واحصل على العنوان الذكي والمدخل الصحيح لكل غرض.",
      },
      { property: "og:title", content: "البحث في الشبكة — العنوان الذكي السوري" },
      {
        property: "og:description",
        content: "بحث موحّد يفهم الأسماء الشائعة والمعالم، مع احترام خصوصية العناوين السكنية.",
      },
    ],
  }),
  component: SearchPage,
});

const GOVERNORATE_EN: Record<string, string> = {
  "دمشق": "Damascus",
  "ريف دمشق": "Rif Dimashq",
  "حلب": "Aleppo",
  "حمص": "Homs",
  "حماة": "Hama",
  "اللاذقية": "Latakia",
  "طرطوس": "Tartus",
  "دير الزور": "Deir ez-Zor",
  "الحسكة": "Al-Hasakah",
  "إدلب": "Idlib",
  "درعا": "Daraa",
  "السويداء": "As-Suwayda",
  "القنيطرة": "Quneitra",
  "الرقة": "Raqqa",
};

const NODE_TYPE_EN: Record<string, string> = {
  property: "Property / site",
  land: "Land",
  building: "Building",
  floor: "Floor",
  apartment: "Apartment",
  office: "Office",
  shop: "Shop",
  clinic: "Clinic",
  warehouse: "Warehouse",
  farm: "Farm",
  field: "Field",
  factory: "Factory",
  school: "School",
  hospital: "Hospital",
  hotel: "Hotel",
  government_office: "Government office",
  pickup_point: "Pickup point",
  poi: "Point of interest",
  custom: "Other",
};

const VERIFICATION_EN: Record<string, string> = {
  unverified: "Unverified",
  user_confirmed: "Confirmed by owner",
  community_confirmed: "Community confirmed",
  courier_verified: "Verified by courier",
  business_verified: "Verified business",
};

function governorateLabel(ar: string, lang: Lang) {
  return lang === "ar" ? ar : GOVERNORATE_EN[ar] ?? ar;
}

function nodeTypeLabel(value: string, lang: Lang) {
  return lang === "ar" ? (NODE_TYPE_LABELS[value] ?? value) : NODE_TYPE_EN[value] ?? value;
}

function verificationLabel(level: string | undefined, lang: Lang) {
  const meta = level ? VERIFICATION_LEVELS[level] : undefined;
  if (!level || !meta) {
    return lang === "ar" ? "غير موثق" : "Unverified";
  }
  return lang === "ar" ? meta.ar : (VERIFICATION_EN[level] ?? "Unverified");
}

function SearchPage() {
  const { t, lang } = useI18n();
  const search = useServerFn(searchNetwork);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [governorate, setGovernorate] = useState<string | undefined>(undefined);
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (value: string) =>
      search({
        data: {
          query: value,
          ...(category ? { category } : {}),
          ...(governorate ? { governorate } : {}),
          ...(origin ?? {}),
        },
      }),
  });

  const useMyLocation = () => {
    if (origin) {
      setOrigin(null);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setGeoBusy(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoBusy(false);
      },
      () => {
        setGeoBusy(false);
        setGeoError(t({ ar: "تعذّر تحديد موقعك. يمكنك متابعة البحث دون الموقع.", en: "We couldn't access your location. You can keep searching without it." }));
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
    );
  };

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => mutation.mutate(query), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, governorate, origin]);

  const data = mutation.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <div className="border-b border-border bg-surface/70 px-4 py-4">
        <div className="relative mx-auto max-w-3xl">
          <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <input
            id="network-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t({
              ar: "رمز ذكي، اسم نشاط، حي، منطقة، معلم… (عربي أو English)",
              en: "Smart code, business name, neighborhood, district, landmark… (Arabic or English)",
            })}
            aria-label={t({ ar: "ابحث في شبكة العناوين العامة", en: "Search the public address network" })}
            aria-describedby="search-privacy search-status"
            className="w-full rounded-lg border border-border bg-background py-3 pe-4 ps-9 text-sm focus:border-primary focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link
              to="/places"
              className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"
            >
              {t({ ar: "دليل الأماكن العامة", en: "Public places directory" })}
            </Link>
            <button
              type="button"
              onClick={() => setCategory(undefined)}
              aria-pressed={!category}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                category ? "border-border bg-background text-muted-foreground" : "border-primary bg-primary text-primary-foreground"
              }`}
            >
              {t({ ar: "كل التصنيفات", en: "All categories" })}
            </button>
            {PLACE_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(category === c.value ? undefined : c.value)}
                aria-pressed={category === c.value}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                  category === c.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.emoji} {placeCategoryLabel(c.value, lang)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={useMyLocation}
              aria-pressed={Boolean(origin)}
              aria-busy={geoBusy}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                origin
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <Navigation2 className="size-3" />
              {geoBusy
                ? t({ ar: "جارٍ تحديد موقعك…", en: "Locating you…" })
                : origin
                  ? t({ ar: "الأقرب إليّ (مفعّل)", en: "Nearest to me (on)" })
                  : t({ ar: "الأقرب إليّ", en: "Nearest to me" })}
            </button>
            <button
              type="button"
              onClick={() => setGovernorate(undefined)}
              aria-pressed={!governorate}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                governorate
                  ? "border-border bg-background text-muted-foreground"
                  : "border-primary/50 bg-primary/10 text-primary"
              }`}
            >
              {t({ ar: "كل المحافظات", en: "All governorates" })}
            </button>
            {GOVERNORATES.map((g) => (
              <button
                key={g.code}
                type="button"
                onClick={() => setGovernorate(governorate === g.ar ? undefined : g.ar)}
                aria-pressed={governorate === g.ar}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                  governorate === g.ar
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {governorateLabel(g.ar, lang)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {query.trim().length < 2 ? (
          <p id="search-privacy" className="py-12 text-center text-sm text-muted-foreground">
            {t({
              ar: "البحث يفهم الأسماء العربية الشائعة والمعالم والاختصارات. العناوين السكنية غير مُدرجة في النتائج.",
              en: "Search understands common Arabic names, landmarks, and abbreviations. Residential addresses never appear in results.",
            })}
          </p>
        ) : null}

        <div id="search-status" role="status" aria-live="polite" className="sr-only">
          {mutation.isPending
            ? t({ ar: "جارٍ البحث", en: "Searching" })
            : data
              ? t({
                  ar: `${data.codes.length + data.businesses.length + data.places.length} نتيجة`,
                  en: `${data.codes.length + data.businesses.length + data.places.length} results`,
                })
              : ""}
        </div>
        {geoError ? <p role="alert" className="rounded-md bg-prohibit-surface p-3 text-sm text-prohibit">{geoError}</p> : null}

        {data?.codes.length ? (
          <section className="animate-entrance space-y-2">
            {data.codes.map((hit) => (
              <div key={hit.code} className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  {t({ ar: "عنوان ذكي مطابق", en: "Matching smart address" })}
                </span>
                <Link to="/a/$code" params={{ code: hit.code }} className="block font-mono text-lg" dir="ltr">
                  {hit.code}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {hit.label ?? t({ ar: "افتح بطاقة العنوان", en: "Open address card" })}
                </p>
                <span className="mt-2 inline-block">
                  <DirectionsButton code={hit.code} variant="chip" />
                </span>
              </div>
            ))}
          </section>
        ) : null}

        {data?.businesses.length ? (
          <section className="animate-entrance">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Store className="size-3.5" /> {t({ ar: "أعمال ومنشآت", en: "Businesses & establishments" })}
            </h2>
            <div className="space-y-2">
              {data.businesses.map((biz) => {
                const node = Array.isArray(biz.location_nodes)
                  ? biz.location_nodes[0]
                  : biz.location_nodes;
                const smart = Array.isArray(biz.smart_addresses)
                  ? biz.smart_addresses[0]
                  : biz.smart_addresses;
                return (
                  <div
                    key={biz.id}
                    className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          to="/business/$id"
                          params={{ id: biz.id }}
                          className="font-bold leading-tight hover:text-primary"
                        >
                          {biz.name_ar}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {[
                            placeCategoryLabel(biz.place_category, lang) ?? biz.category,
                            node?.neighborhood,
                            node?.city,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      {smart?.code ? (
                        <span className="shrink-0 rounded-md bg-foreground px-2 py-1 font-mono text-[11px] text-background" dir="ltr">
                          {smart.code}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      {smart?.code ? <DirectionsButton code={smart.code} variant="chip" /> : null}
                      {biz.opening_hours ? <span>{biz.opening_hours}</span> : null}
                      {biz.phone ? (
                        <span dir="ltr" className="font-mono">
                          {biz.phone}
                        </span>
                      ) : null}
                      <span>{verificationLabel(biz.verification_level, lang)}</span>
                      {biz.distance_m != null ? (
                        <span className="font-mono">{formatDistance(biz.distance_m, lang)}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {data?.places.length ? (
          <section className="animate-entrance">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Building2 className="size-3.5" /> {t({ ar: "مواقع ومبانٍ عامة", en: "Public sites & buildings" })}
            </h2>
            <div className="space-y-2">
              {data.places.map((place) => (
                <div
                  key={place.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface p-4"
                >
                  <div>
                    <p className="font-bold leading-tight">{place.display_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        placeCategoryLabel(place.place_category, lang) ??
                          nodeTypeLabel(place.node_type, lang),
                        place.neighborhood,
                        place.city,
                        place.governorate,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {place.landmark ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Landmark className="size-3" /> {place.landmark}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-muted-foreground">
                    {place.code ? (
                      <Link
                        to="/a/$code"
                        params={{ code: place.code }}
                        className="rounded-md bg-foreground px-2 py-1 font-mono text-background"
                        dir="ltr"
                      >
                        {place.code}
                      </Link>
                    ) : null}
                    {place.code ? <DirectionsButton code={place.code} variant="chip" /> : null}
                    {place.distance_m != null ? (
                      <span className="font-mono">{formatDistance(place.distance_m, lang)}</span>
                    ) : null}
                    <span className="font-mono">{place.confidence_score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {data && !data.businesses.length && !data.places.length && !data.code ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t({ ar: "لا نتائج. جرّب اسم الحي أو معلماً قريباً.", en: "No results. Try a neighborhood name or a nearby landmark." })}
          </p>
        ) : null}
      </main>
    </div>
  );
}
