import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Building2, Landmark, Navigation2, Search as SearchIcon, Store } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { DirectionsButton } from "@/components/DirectionsButton";
import { searchNetwork } from "@/lib/addresses.functions";
import { PLACE_CATEGORIES, PLACE_CATEGORY_META } from "@/lib/place-categories";
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

function formatDistance(meters?: number | null) {
  if (meters == null) return null;
  return meters < 1000 ? `${meters} م` : `${(meters / 1000).toFixed(1)} كم`;
}

function SearchPage() {
  const search = useServerFn(searchNetwork);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [governorate, setGovernorate] = useState<string | undefined>(undefined);
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGeoBusy(false);
      },
      () => setGeoBusy(false),
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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="رمز ذكي، اسم نشاط، حي، منطقة، معلم… (عربي أو English)"
            className="w-full rounded-lg border border-border bg-background py-3 pe-4 ps-9 text-sm focus:border-primary focus:outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link
              to="/places"
              className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary"
            >
              دليل الأماكن العامة
            </Link>
            <button
              type="button"
              onClick={() => setCategory(undefined)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                category ? "border-border bg-background text-muted-foreground" : "border-primary bg-primary text-primary-foreground"
              }`}
            >
              كل التصنيفات
            </button>
            {PLACE_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(category === c.value ? undefined : c.value)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                  category === c.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.emoji} {c.ar}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={useMyLocation}
              className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                origin
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <Navigation2 className="size-3" />
              {geoBusy ? "جارٍ تحديد موقعك…" : origin ? "الأقرب إليّ (مفعّل)" : "الأقرب إليّ"}
            </button>
            <button
              type="button"
              onClick={() => setGovernorate(undefined)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                governorate
                  ? "border-border bg-background text-muted-foreground"
                  : "border-primary/50 bg-primary/10 text-primary"
              }`}
            >
              كل المحافظات
            </button>
            {GOVERNORATES.map((g) => (
              <button
                key={g.code}
                type="button"
                onClick={() => setGovernorate(governorate === g.ar ? undefined : g.ar)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${
                  governorate === g.ar
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {g.ar}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        {query.trim().length < 2 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            البحث يفهم الأسماء العربية الشائعة والمعالم والاختصارات. العناوين السكنية غير مُدرجة في النتائج.
          </p>
        ) : null}

        {data?.code ? (
          <Link
            to="/"
            search={{ code: data.code.code }}
            className="animate-entrance rounded-2xl border border-primary/40 bg-primary/5 p-4"
          >
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              عنوان ذكي مطابق
            </span>
            <p className="font-mono text-lg" dir="ltr">
              {data.code.code}
            </p>
            <p className="text-xs text-muted-foreground">{data.code.label ?? "حلّل هذا الرمز"}</p>
            <span className="mt-2 inline-block">
              <DirectionsButton code={data.code.code} variant="chip" />
            </span>
          </Link>
        ) : null}

        {data?.businesses.length ? (
          <section className="animate-entrance">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Store className="size-3.5" /> أعمال ومنشآت
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
                  <Link
                    key={biz.id}
                    to="/business/$id"
                    params={{ id: biz.id }}
                    className="block rounded-xl border border-border bg-surface p-4 shadow-sm transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold leading-tight">{biz.name_ar}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            PLACE_CATEGORY_META[biz.place_category ?? ""]?.ar ?? biz.category,
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
                      <span>{VERIFICATION_LEVELS[biz.verification_level]?.ar ?? "غير موثق"}</span>
                      {formatDistance(biz.distance_m) ? (
                        <span className="font-mono">{formatDistance(biz.distance_m)}</span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {data?.places.length ? (
          <section className="animate-entrance">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Building2 className="size-3.5" /> مواقع ومبانٍ عامة
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
                        PLACE_CATEGORY_META[place.place_category ?? ""]?.ar ??
                          NODE_TYPE_LABELS[place.node_type] ??
                          place.node_type,
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
                    {formatDistance(place.distance_m) ? (
                      <span className="font-mono">{formatDistance(place.distance_m)}</span>
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
            لا نتائج. جرّب اسم الحي أو معلماً قريباً.
          </p>
        ) : null}
      </main>
    </div>
  );
}
