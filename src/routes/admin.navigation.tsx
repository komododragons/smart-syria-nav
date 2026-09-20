import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, AlertTriangle, Flag, Share2 } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  listRouteReports,
  navigationAnalytics,
  reviewRouteReport,
} from "@/lib/navigation/admin.functions";
import { useI18n, type Bilingual } from "@/lib/i18n";

export const Route = createFileRoute("/admin/navigation")({
  head: () => ({
    meta: [
      { title: "لوحة التوجيه والملاحة" },
      {
        name: "description",
        content: "مراجعة بلاغات الطرق والمداخل، ومؤشرات استخدام الملاحة في الشبكة السورية للعنوان الذكي.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminNavigationPage,
});

const CATEGORY_LABELS: Record<string, Bilingual> = {
  road_closed: { ar: "طريق مغلق", en: "Road closed" },
  wrong_entrance: { ar: "مدخل خاطئ", en: "Wrong entrance" },
  no_access: { ar: "تعذّر الوصول", en: "Could not access" },
  bad_instructions: { ar: "تعليمات غير دقيقة", en: "Inaccurate instructions" },
  wrong_location: { ar: "موقع خاطئ", en: "Wrong location" },
  other: { ar: "أخرى", en: "Other" },
};

const STATUS_LABELS: Record<string, Bilingual> = {
  open: { ar: "مفتوح", en: "Open" },
  reviewing: { ar: "قيد المراجعة", en: "In review" },
  resolved: { ar: "معالج", en: "Resolved" },
  rejected: { ar: "مرفوض", en: "Rejected" },
};

const EVENT_LABELS: Record<string, Bilingual> = {
  directions_requested: { ar: "طلب توجيه", en: "Directions requested" },
  navigation_started: { ar: "بدء ملاحة", en: "Navigation started" },
  navigation_completed: { ar: "وصول", en: "Arrived" },
  navigation_abandoned: { ar: "إنهاء مبكر", en: "Abandoned early" },
  route_calculated: { ar: "حساب مسار", en: "Route calculated" },
  multi_stop_route_created: { ar: "مسار متعدد المحطات", en: "Multi-stop route created" },
  route_share_created: { ar: "رابط وجهة", en: "Destination link created" },
  route_problem_reported: { ar: "بلاغ مشكلة", en: "Problem reported" },
};

function Bars({ rows, t }: { rows: [string, number][]; t: (v: Bilingual) => string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="mt-2 space-y-1.5">
      {rows.map(([key, count]) => (
        <li key={key} className="text-xs">
          <div className="flex items-center justify-between">
            <span>{EVENT_LABELS[key] ? t(EVENT_LABELS[key]) : key}</span>
            <span className="font-mono text-muted-foreground">{count}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
      {rows.length === 0 ? <li className="text-xs text-muted-foreground">{t({ ar: "لا بيانات.", en: "No data." })}</li> : null}
    </ul>
  );
}

function AdminNavigationPage() {
  const { t, date } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reportsFn = useServerFn(listRouteReports);
  const statsFn = useServerFn(navigationAnalytics);
  const reviewFn = useServerFn(reviewRouteReport);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [status, setStatus] = useState<"open" | "reviewing" | "resolved" | "rejected" | "all">("open");
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const reports = useQuery({
    queryKey: ["route-reports", status],
    queryFn: () => reportsFn({ data: { status } }),
    enabled: authed === true,
    retry: false,
  });

  const stats = useQuery({
    queryKey: ["navigation-analytics"],
    queryFn: () => statsFn({}),
    enabled: authed === true,
    retry: false,
  });

  const review = useMutation({
    mutationFn: (input: { id: string; status: "reviewing" | "resolved" | "rejected" }) =>
      reviewFn({ data: { ...input, notes: notes[input.id] ?? null } }),
    onSuccess: () => {
      toast.success(t({ ar: "تم تحديث البلاغ", en: "Report updated" }));
      queryClient.invalidateQueries({ queryKey: ["route-reports"] });
      queryClient.invalidateQueries({ queryKey: ["navigation-analytics"] });
    },
    onError: () => toast.error(t({ ar: "تعذّر تحديث البلاغ — تحتاج صلاحية إشراف", en: "Could not update the report — moderator role required" })),
  });

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign-in required" })}</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/navigation" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
          </button>
        </main>
      </div>
    );
  }

  const forbidden = reports.isError || stats.isError;

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header>
          <h1 className="flex items-center gap-2 text-xl font-bold text-primary">
            <Activity className="h-5 w-5" /> {t({ ar: "لوحة التوجيه والملاحة", en: "Navigation & routing dashboard" })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t({
              ar: "بلاغات الطرق والمداخل ومؤشرات الاستخدام لآخر ١٤ يوماً — بدون أي بيانات شخصية.",
              en: "Road and entrance reports plus usage metrics for the last 14 days — no personal data.",
            })}
          </p>
        </header>

        {forbidden ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            {t({ ar: "تحتاج صلاحية مشرف أو إشراف للوصول إلى هذه اللوحة.", en: "Admin or moderator role required to access this dashboard." })}
          </div>
        ) : null}

        {stats.data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              {[
                { label: t({ ar: "أحداث الملاحة", en: "Navigation events" }), value: stats.data.total, icon: Activity },
                { label: t({ ar: "عمليات فاشلة", en: "Failed attempts" }), value: stats.data.failures, icon: AlertTriangle },
                { label: t({ ar: "بلاغات مفتوحة", en: "Open reports" }), value: stats.data.openReports, icon: Flag },
                { label: t({ ar: "روابط وجهة فعّالة", en: "Active destination links" }), value: stats.data.activeShares, icon: Share2 },
              ].map((card) => (
                <div key={card.label} className="rounded-xl border border-border bg-card p-4">
                  <card.icon className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-2xl font-bold">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold">{t({ ar: "حسب نوع الحدث", en: "By event type" })}</h2>
                <Bars rows={stats.data.byEvent as [string, number][]} t={t} />
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold">{t({ ar: "حسب نمط التنقل", en: "By travel mode" })}</h2>
                <Bars rows={stats.data.byMode as [string, number][]} t={t} />
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold">{t({ ar: "حسب نوع نقطة الوصول", en: "By destination kind" })}</h2>
                <Bars rows={stats.data.byDestinationKind as [string, number][]} t={t} />
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold">{t({ ar: "حسب المدينة", en: "By city" })}</h2>
                <Bars rows={stats.data.byCity as [string, number][]} t={t} />
              </div>
            </section>
          </>
        ) : null}

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{t({ ar: "بلاغات الطرق والمداخل", en: "Road & entrance reports" })}</h2>
            <div className="flex flex-wrap gap-1">
              {(["open", "reviewing", "resolved", "rejected", "all"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`rounded-lg border px-2.5 py-1 text-xs ${
                    status === s ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {s === "all" ? t({ ar: "الكل", en: "All" }) : t(STATUS_LABELS[s])}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-3 space-y-3">
            {(reports.data?.reports ?? []).map((r: any) => (
              <li key={r.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {CATEGORY_LABELS[r.category] ? t(CATEGORY_LABELS[r.category]) : r.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABELS[r.status] ? t(STATUS_LABELS[r.status]) : r.status} ·{" "}
                    {date(r.created_at)}
                  </span>
                  {r.latitude != null ? (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                    </span>
                  ) : null}
                </div>
                {r.description ? <p className="mt-2 text-xs">{r.description}</p> : null}
                {r.review_notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">{t({ ar: "ملاحظة المراجعة", en: "Review note" })}: {r.review_notes}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                    placeholder={t({ ar: "ملاحظة المراجعة", en: "Review note" })}
                    className="min-w-[180px] flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-xs"
                  />
                  {(["reviewing", "resolved", "rejected"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={review.isPending}
                      onClick={() => review.mutate({ id: r.id, status: s })}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {t(STATUS_LABELS[s])}
                    </button>
                  ))}
                </div>
              </li>
            ))}
            {reports.data && reports.data.reports.length === 0 ? (
              <li className="text-xs text-muted-foreground">{t({ ar: "لا توجد بلاغات ضمن هذا التصنيف.", en: "No reports in this category." })}</li>
            ) : null}
          </ul>
        </section>
      </main>
    </div>
  );
}
