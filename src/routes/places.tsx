import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { BadgeCheck, MapPin, Search as SearchIcon, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { DirectionsButton } from "@/components/DirectionsButton";
import { useI18n, type Lang } from "@/lib/i18n";
import { PLACE_CATEGORIES, placeCategoryLabel } from "@/lib/place-categories";
import { listPublicPlaces } from "@/lib/places.functions";
import { REGION_PACKAGES } from "@/lib/offline.functions";
import { VERIFICATION_LEVELS } from "@/lib/smart-address";

export const Route = createFileRoute("/places")({
  head: () => ({
    meta: [
      { title: "دليل الأماكن العامة — سيرياسان" },
      {
        name: "description",
        content:
          "دليل مصنّف للأماكن العامة في سوريا: مشافي، صيدليات، عيادات، مدارس، جامعات، دوائر حكومية، مصارف، صرافات، فنادق، مطاعم، محطات وقود، معامل، مستودعات، مراكز تسوق، مراكز نقل، معالم سياحية، مرافق عامة وطوارئ.",
      },
      { property: "og:title", content: "دليل الأماكن العامة — سيرياسان" },
      {
        property: "og:description",
        content: "ابحث بالتصنيف عن الأماكن العامة الموثقة ورموزها الذكية في كل محافظة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlacesPage,
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

function verificationLabel(level: string | undefined, lang: Lang) {
  if (!level || !VERIFICATION_LEVELS[level]) {
    return lang === "ar" ? "غير موثق" : "Unverified";
  }
  return lang === "ar" ? VERIFICATION_LEVELS[level].ar : VERIFICATION_EN[level] ?? VERIFICATION_EN["unverified"];
}

function PlacesPage() {
  const { t, lang } = useI18n();
  const fetchPlaces = useServerFn(listPublicPlaces);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [governorate, setGovernorate] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["public-places", category, governorate, query],
    queryFn: () =>
      fetchPlaces({
        data: {
          ...(category ? { category } : {}),
          ...(governorate ? { governorate } : {}),
          ...(query.trim().length >= 2 ? { query: query.trim() } : {}),
          limit: 60,
        },
      }),
  });

  const places = data?.places ?? [];

  return (
    <div className="min-h-screen bg-secondary">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-4 p-4">
        <header className="rounded-2xl border border-border bg-background p-5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {t({ ar: "دليل عام", en: "Public directory" })}
          </span>
          <h1 className="mt-1 text-xl font-bold">{t({ ar: "الأماكن العامة في سوريا", en: "Public places in Syria" })}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {t({
              ar: "مشافٍ وصيدليات وعيادات ومدارس وجامعات ودوائر حكومية ومصارف وصرافات وفنادق ومطاعم ومحطات وقود ومعامل ومستودعات ومراكز تسوق ومراكز نقل ومعالم سياحية ومرافق عامة ومرافق طوارئ — كلٌّ برمزه الذكي حين يكون موثقاً.",
              en: "Hospitals, pharmacies, clinics, schools, universities, government offices, banks, ATMs, hotels, restaurants, fuel stations, factories, warehouses, shopping centers, transport hubs, tourist attractions, public facilities, and emergency facilities — each with its smart code once verified.",
            })}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-primary">
            <ShieldCheck className="size-3.5" />
            {t({
              ar: "العناوين السكنية الخاصة لا تظهر في هذا الدليل ولا في البحث العام إطلاقاً.",
              en: "Private residential addresses never appear in this directory or in public search.",
            })}
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t({ ar: "ابحث بالاسم أو الحي أو المعلم", en: "Search by name, neighborhood, or landmark" })}
              className="w-full rounded-lg border border-border bg-surface py-3 pe-4 ps-9 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip active={!category} onClick={() => setCategory(undefined)} label={t({ ar: "كل التصنيفات", en: "All categories" })} />
            {PLACE_CATEGORIES.map((c) => (
              <Chip
                key={c.value}
                active={category === c.value}
                onClick={() => setCategory(category === c.value ? undefined : c.value)}
                label={`${c.emoji} ${placeCategoryLabel(c.value, lang)}`}
              />
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip active={!governorate} onClick={() => setGovernorate(undefined)} label={t({ ar: "كل المحافظات", en: "All governorates" })} />
            {REGION_PACKAGES.map((r) => (
              <Chip
                key={r.code}
                active={governorate === r.ar}
                onClick={() => setGovernorate(governorate === r.ar ? undefined : r.ar)}
                label={governorateLabel(r.ar, lang)}
              />
            ))}
          </div>
        </div>

        <section className="space-y-2">
          {isFetching && places.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p>
          ) : null}

          {!isFetching && places.length === 0 ? (
            <p className="rounded-2xl border border-border bg-background py-10 text-center text-sm text-muted-foreground">
              {t({
                ar: "لا توجد أماكن مطابقة بعد ضمن هذا التصنيف. يمكن لأصحاب المنشآت إضافة مواقعهم وتصنيفها.",
                en: "No matching places yet in this category. Business owners can add and categorize their locations.",
              })}
            </p>
          ) : null}

          {places.map((place) => {
            const label = placeCategoryLabel(place.category, lang);
            const meta = PLACE_CATEGORIES.find((c) => c.value === place.category);
            return (
              <article
                key={`${place.kind}-${place.id}`}
                className="rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {label ? `${meta?.emoji ?? ""} ${label}`.trim() : place.category}
                    </span>
                    <h2 className="truncate text-base font-bold">{place.name}</h2>
                    <p className="truncate text-xs text-muted-foreground">
                      {[place.neighborhood, place.city, place.governorate].filter(Boolean).join(" · ")}
                    </p>
                    {place.landmark ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="size-3" /> {place.landmark}
                      </p>
                    ) : null}
                  </div>
                  {place.code ? (
                    <Link
                      to="/a/$code"
                      params={{ code: place.code }}
                      className="shrink-0 rounded-md bg-foreground px-2 py-1 font-mono text-[11px] text-background"
                      dir="ltr"
                    >
                      {place.code}
                    </Link>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {place.code ? <DirectionsButton code={place.code} variant="chip" /> : null}
                  {place.kind === "business" ? (
                    <Link to="/business/$id" params={{ id: place.id }} className="underline">
                      {t({ ar: "بطاقة المنشأة", en: "Business card" })}
                    </Link>
                  ) : null}
                  {place.opening_hours ? <span>{place.opening_hours}</span> : null}
                  {place.phone ? (
                    <a href={`tel:${place.phone}`} dir="ltr" className="font-mono underline">
                      {place.phone}
                    </a>
                  ) : null}
                  <span className="flex items-center gap-1">
                    <BadgeCheck className="size-3" />
                    {verificationLabel(place.verification_level, lang)}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
