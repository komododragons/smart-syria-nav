import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { qualityDashboard } from "@/lib/quality.functions";
import { useI18n, type Bilingual } from "@/lib/i18n";

export const Route = createFileRoute("/admin/quality")({
  head: () => ({
    meta: [
      { title: "جودة العناوين — لوحة التحسين" },
      {
        name: "description",
        content:
          "مؤشر داخلي لجودة العناوين: عناوين ناقصة، ازدواجيات محتملة، عناوين قديمة، أعمال غير موثقة، إحداثيات مفقودة، ومواقع مُبلّغ عنها.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QualityPage,
});

const TABS = [
  { key: "incomplete", label: { ar: "عناوين ناقصة", en: "Incomplete addresses" } },
  { key: "duplicates", label: { ar: "ازدواجيات محتملة", en: "Possible duplicates" } },
  { key: "stale", label: { ar: "عناوين قديمة", en: "Stale addresses" } },
  { key: "businesses", label: { ar: "أعمال غير موثقة", en: "Unverified businesses" } },
  { key: "coordinates", label: { ar: "إحداثيات مفقودة", en: "Missing coordinates" } },
  { key: "reports", label: { ar: "مواقع مُبلّغ عنها", en: "Reported locations" } },
] as const satisfies readonly { key: string; label: Bilingual }[];

type TabKey = (typeof TABS)[number]["key"];

const GRADE_COLOR: Record<string, string> = {
  excellent: "text-allow",
  good: "text-allow",
  fair: "text-foreground",
  poor: "text-prohibit",
};

function QualityPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const dashboardFn = useServerFn(qualityDashboard);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabKey>("incomplete");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["quality-dashboard"],
    queryFn: () => dashboardFn({ data: undefined as never }),
    enabled: authed === true,
  });

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign in required" })}</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/quality" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
          </button>
        </main>
      </div>
    );
  }

  const data = query.data?.authorized ? query.data : null;

  const counts: Record<TabKey, number> = {
    incomplete: data?.incomplete.length ?? 0,
    duplicates: data?.duplicates.length ?? 0,
    stale: data?.stale.length ?? 0,
    businesses: data?.unverified_businesses.length ?? 0,
    coordinates: data?.missing_coordinates.length ?? 0,
    reports: data?.reports.length ?? 0,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Gauge className="size-5" /> {t({ ar: "جودة العناوين", en: "Address quality" })}
        </h1>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحليل…", en: "Analyzing…" })}</p>
        ) : null}

        {query.data && !query.data.authorized ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t({ ar: "هذه اللوحة مخصصة للمشرفين والمراجعين فقط.", en: "This dashboard is for admins and reviewers only." })}
          </p>
        ) : null}

        {data ? (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: t({ ar: "عناوين مُقيّمة", en: "Addresses evaluated" }), value: data.summary.evaluated },
                { label: t({ ar: "متوسط الجودة", en: "Average quality" }), value: `${data.summary.average_score}%` },
                { label: t({ ar: "جودة ضعيفة", en: "Poor quality" }), value: data.summary.poor },
                { label: t({ ar: "جودة ممتازة", en: "Excellent quality" }), value: data.summary.excellent },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border bg-surface p-3">
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className="mt-1 font-mono text-lg font-bold" dir="ltr">
                    {item.value}
                  </p>
                </div>
              ))}
            </section>

            <div className="flex flex-wrap gap-1.5">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    tab === item.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground"
                  }`}
                >
                  {t(item.label)} ({counts[item.key]})
                </button>
              ))}
            </div>

            <section className="flex flex-col gap-2">
              {tab === "duplicates"
                ? data.duplicates.map((row) => (
                    <div key={row.id} className="rounded-2xl border border-border bg-surface p-3 text-xs">
                      <p className="font-bold">
                        {row.name_a} ↔ {row.name_b}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {t({ ar: `المسافة بينهما: ${row.distance_meters ?? "?"} م`, en: `Distance between them: ${row.distance_meters ?? "?"} m` })}
                      </p>
                    </div>
                  ))
                : null}

              {tab === "businesses"
                ? data.unverified_businesses.map((biz) => (
                    <div key={biz.id} className="rounded-2xl border border-border bg-surface p-3 text-xs">
                      <p className="font-bold">{biz.name_ar}</p>
                      <p className="mt-1 text-muted-foreground">
                        {biz.category ?? t({ ar: "بدون تصنيف", en: "Uncategorized" })} —{" "}
                        {t({ ar: "التوثيق:", en: "Verification:" })} {biz.verification_level}
                      </p>
                    </div>
                  ))
                : null}

              {tab === "reports"
                ? data.reports.map((report) => (
                    <div
                      key={`${report.kind}-${report.id}`}
                      className="rounded-2xl border border-border bg-surface p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold">
                          {report.kind === "correction" ? t({ ar: "تصحيح عنوان", en: "Address correction" }) : t({ ar: "بلاغ طريق", en: "Road report" })} — {report.label}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(report.created_at).toLocaleDateString(lang === "ar" ? "ar-SY" : "en-US")}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {report.node_name ?? ""} {report.details ?? ""}
                      </p>
                    </div>
                  ))
                : null}

              {tab === "incomplete" || tab === "stale" || tab === "coordinates"
                ? (tab === "incomplete"
                    ? data.incomplete
                    : tab === "stale"
                      ? data.stale
                      : data.missing_coordinates
                  ).map((row) => (
                    <div
                      key={row.node_id}
                      className="rounded-2xl border border-border bg-surface p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold">{row.display_name}</p>
                        <span className={`font-mono font-bold ${GRADE_COLOR[row.grade]}`} dir="ltr">
                          {row.score}%
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {[row.city, row.governorate].filter(Boolean).join(" — ") || t({ ar: "بدون موقع إداري", en: "No administrative location" })}
                        {row.stale_days != null
                          ? t({ ar: ` — آخر تأكيد قبل ${row.stale_days} يوم`, en: ` — last confirmed ${row.stale_days} days ago` })
                          : t({ ar: " — لا تأكيد ميداني", en: " — no field confirmation" })}
                      </p>
                      {row.missing.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {row.missing.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                : null}

              {counts[tab] === 0 ? (
                <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
                  {t({ ar: "لا عناصر في هذه القائمة.", en: "No items in this list." })}
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
