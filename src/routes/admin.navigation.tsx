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

const CATEGORY_LABELS: Record<string, string> = {
  road_closed: "طريق مغلق",
  wrong_entrance: "مدخل خاطئ",
  no_access: "تعذّر الوصول",
  bad_instructions: "تعليمات غير دقيقة",
  wrong_location: "موقع خاطئ",
  other: "أخرى",
};

const STATUS_LABELS: Record<string, string> = {
  open: "مفتوح",
  reviewing: "قيد المراجعة",
  resolved: "معالج",
  rejected: "مرفوض",
};

const EVENT_LABELS: Record<string, string> = {
  directions_requested: "طلب توجيه",
  navigation_started: "بدء ملاحة",
  navigation_completed: "وصول",
  navigation_abandoned: "إنهاء مبكر",
  route_calculated: "حساب مسار",
  multi_stop_route_created: "مسار متعدد المحطات",
  route_share_created: "رابط وجهة",
  route_problem_reported: "بلاغ مشكلة",
};

function Bars({ rows }: { rows: [string, number][]; }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className="mt-2 space-y-1.5">
      {rows.map(([key, count]) => (
        <li key={key} className="text-xs">
          <div className="flex items-center justify-between">
            <span>{EVENT_LABELS[key] ?? key}</span>
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
      {rows.length === 0 ? <li className="text-xs text-muted-foreground">لا بيانات.</li> : null}
    </ul>
  );
}

function AdminNavigationPage() {
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
      toast.success("تم تحديث البلاغ");
      queryClient.invalidateQueries({ queryKey: ["route-reports"] });
      queryClient.invalidateQueries({ queryKey: ["navigation-analytics"] });
    },
    onError: () => toast.error("تعذّر تحديث البلاغ — تحتاج صلاحية إشراف"),
  });

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">يلزم تسجيل الدخول</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/navigation" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            الدخول
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
            <Activity className="h-5 w-5" /> لوحة التوجيه والملاحة
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            بلاغات الطرق والمداخل ومؤشرات الاستخدام لآخر ١٤ يوماً — بدون أي بيانات شخصية.
          </p>
        </header>

        {forbidden ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            تحتاج صلاحية مشرف أو إشراف للوصول إلى هذه اللوحة.
          </div>
        ) : null}

        {stats.data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-4">
              {[
                { label: "أحداث الملاحة", value: stats.data.total, icon: Activity },
                { label: "عمليات فاشلة", value: stats.data.failures, icon: AlertTriangle },
                { label: "بلاغات مفتوحة", value: stats.data.openReports, icon: Flag },
                { label: "روابط وجهة فعّالة", value: stats.data.activeShares, icon: Share2 },
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
                <h2 className="text-sm font-bold">حسب نوع الحدث</h2>
                <Bars rows={stats.data.byEvent as [string, number][]} />
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold">حسب نمط التنقل</h2>
                <Bars rows={stats.data.byMode as [string, number][]} />
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold">حسب نوع نقطة الوصول</h2>
                <Bars rows={stats.data.byDestinationKind as [string, number][]} />
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold">حسب المدينة</h2>
                <Bars rows={stats.data.byCity as [string, number][]} />
              </div>
            </section>
          </>
        ) : null}

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">بلاغات الطرق والمداخل</h2>
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
                  {s === "all" ? "الكل" : STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-3 space-y-3">
            {(reports.data?.reports ?? []).map((r: any) => (
              <li key={r.id} className="rounded-lg border border-border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                    {CATEGORY_LABELS[r.category] ?? r.category}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABELS[r.status] ?? r.status} ·{" "}
                    {new Date(r.created_at).toLocaleString("ar-SY")}
                  </span>
                  {r.latitude != null ? (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
                    </span>
                  ) : null}
                </div>
                {r.description ? <p className="mt-2 text-xs">{r.description}</p> : null}
                {r.review_notes ? (
                  <p className="mt-1 text-xs text-muted-foreground">ملاحظة المراجعة: {r.review_notes}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
                    placeholder="ملاحظة المراجعة"
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
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </li>
            ))}
            {reports.data && reports.data.reports.length === 0 ? (
              <li className="text-xs text-muted-foreground">لا توجد بلاغات ضمن هذا التصنيف.</li>
            ) : null}
          </ul>
        </section>
      </main>
    </div>
  );
}
