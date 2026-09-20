import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { qualityDashboard } from "@/lib/quality.functions";

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
  { key: "incomplete", label: "عناوين ناقصة" },
  { key: "duplicates", label: "ازدواجيات محتملة" },
  { key: "stale", label: "عناوين قديمة" },
  { key: "businesses", label: "أعمال غير موثقة" },
  { key: "coordinates", label: "إحداثيات مفقودة" },
  { key: "reports", label: "مواقع مُبلّغ عنها" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const GRADE_COLOR: Record<string, string> = {
  excellent: "text-allow",
  good: "text-allow",
  fair: "text-foreground",
  poor: "text-prohibit",
};

function QualityPage() {
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
          <h1 className="text-xl font-bold">يلزم تسجيل الدخول</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/quality" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            الدخول
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
          <Gauge className="size-5" /> جودة العناوين
        </h1>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحليل…</p>
        ) : null}

        {query.data && !query.data.authorized ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            هذه اللوحة مخصصة للمشرفين والمراجعين فقط.
          </p>
        ) : null}

        {data ? (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "عناوين مُقيّمة", value: data.summary.evaluated },
                { label: "متوسط الجودة", value: `${data.summary.average_score}%` },
                { label: "جودة ضعيفة", value: data.summary.poor },
                { label: "جودة ممتازة", value: data.summary.excellent },
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
                  {item.label} ({counts[item.key]})
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
                        المسافة بينهما: {row.distance_meters ?? "?"} م
                      </p>
                    </div>
                  ))
                : null}

              {tab === "businesses"
                ? data.unverified_businesses.map((biz) => (
                    <div key={biz.id} className="rounded-2xl border border-border bg-surface p-3 text-xs">
                      <p className="font-bold">{biz.name_ar}</p>
                      <p className="mt-1 text-muted-foreground">
                        {biz.category ?? "بدون تصنيف"} — التوثيق: {biz.verification_level}
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
                          {report.kind === "correction" ? "تصحيح عنوان" : "بلاغ طريق"} — {report.label}
                        </p>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(report.created_at).toLocaleDateString("ar-SY")}
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
                        {[row.city, row.governorate].filter(Boolean).join(" — ") || "بدون موقع إداري"}
                        {row.stale_days != null
                          ? ` — آخر تأكيد قبل ${row.stale_days} يوم`
                          : " — لا تأكيد ميداني"}
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
                  لا عناصر في هذه القائمة.
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
