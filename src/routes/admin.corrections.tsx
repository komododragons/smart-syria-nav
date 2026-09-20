import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { correctionQueue } from "@/lib/corrections.functions";
import { reviewCorrection } from "@/lib/addresses.functions";
import { CORRECTION_DECISION_LABELS, CORRECTION_TYPE_LABELS } from "@/lib/smart-address";

export const Route = createFileRoute("/admin/corrections")({
  head: () => ({
    meta: [
      { title: "مراجعة تصحيحات المجتمع" },
      {
        name: "description",
        content:
          "سير عمل مراجعة بلاغات المجتمع: القيمة الأصلية مقابل التعديل المقترح، قرار المراجع، ووقت التطبيق.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CorrectionsPage,
});

const FILTERS = [
  { key: "pending", label: "بانتظار المراجعة" },
  { key: "under_review", label: "بحاجة لمعلومات" },
  { key: "approved", label: "مقبولة" },
  { key: "rejected", label: "مرفوضة" },
  { key: "all", label: "الكل" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const FIELD_LABELS: Record<string, string> = {
  node_coordinates: "إحداثيات الموقع",
  business_name: "اسم النشاط",
  business_status: "حالة النشاط",
  business_category: "تصنيف النشاط",
  place_category: "تصنيف المكان",
  entrance: "المدخل",
  access: "الوصول",
  other: "أخرى",
};

function CorrectionsPage() {
  const navigate = useNavigate();
  const queueFn = useServerFn(correctionQueue);
  const reviewFn = useServerFn(reviewCorrection);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["correction-queue", filter],
    queryFn: () => queueFn({ data: { status: filter } }),
    enabled: authed === true,
  });

  const decide = async (
    id: string,
    decision: "approved" | "rejected" | "needs_more_info",
    apply: boolean,
  ) => {
    setBusyId(id);
    try {
      const result = await reviewFn({
        data: { id, decision, apply, note: notes[id]?.trim() || undefined },
      });
      toast.success(
        result.applied ? "تم قبول التصحيح وتطبيقه على البيانات" : "تم تسجيل القرار في سجل المراجعة",
      );
      await query.refetch();
    } catch {
      toast.error("تعذر حفظ القرار");
    } finally {
      setBusyId(null);
    }
  };

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">يلزم تسجيل الدخول</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/corrections" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            الدخول
          </button>
        </main>
      </div>
    );
  }

  const data = query.data?.authorized ? query.data : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Flag className="size-5" /> تصحيحات المجتمع
        </h1>
        <p className="text-xs text-muted-foreground">
          لا يُعدّل أي عنوان موثّق تلقائياً — كل تصحيح يمر بقرار مراجع، ويُسجَّل الأصل والمقترح
          والمراجع والقرار ووقته.
        </p>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : null}

        {query.data && !query.data.authorized ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            مراجعة التصحيحات متاحة للمشرفين والمراجعين فقط.
          </p>
        ) : null}

        {data ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    filter === item.key
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground"
                  }`}
                >
                  {item.label}
                  {data.counts[item.key] != null ? ` (${data.counts[item.key]})` : ""}
                </button>
              ))}
            </div>

            {data.reports.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
                لا تصحيحات في هذه القائمة.
              </p>
            ) : null}

            {data.reports.map((report) => {
              const node = Array.isArray(report.location_nodes)
                ? report.location_nodes[0]
                : report.location_nodes;
              const biz = Array.isArray(report.businesses) ? report.businesses[0] : report.businesses;
              const open = report.status === "pending" || report.status === "reviewed" || report.status === "under_review";
              return (
                <article key={report.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold">
                        {CORRECTION_TYPE_LABELS[report.issue_type] ?? report.issue_type}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {biz?.name_ar ?? node?.display_name ?? "—"}
                        {report.smart_code ? (
                          <span className="ms-2 font-mono" dir="ltr">
                            {report.smart_code}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(report.created_at).toLocaleString("ar-SY")}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background p-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        القيمة الحالية · {FIELD_LABELS[report.target_field ?? "other"]}
                      </p>
                      <p className="mt-1 text-xs">{report.original_value ?? "غير مسجّلة"}</p>
                    </div>
                    <div className="rounded-lg border border-primary/40 bg-background p-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        التعديل المقترح
                      </p>
                      <p className="mt-1 text-xs font-bold">{report.suggested_value ?? "بدون قيمة محددة"}</p>
                    </div>
                  </div>

                  {report.details ? (
                    <p className="mt-2 text-xs text-muted-foreground">{report.details}</p>
                  ) : null}

                  {open ? (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={notes[report.id] ?? ""}
                        onChange={(event) =>
                          setNotes((prev) => ({ ...prev, [report.id]: event.target.value }))
                        }
                        rows={2}
                        maxLength={400}
                        placeholder="ملاحظة المراجع (اختياري)"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => decide(report.id, "approved", true)}
                          className="rounded-md bg-allow px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                        >
                          قبول وتطبيق
                        </button>
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => decide(report.id, "approved", false)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50"
                        >
                          قبول دون تطبيق
                        </button>
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => decide(report.id, "needs_more_info", false)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground disabled:opacity-50"
                        >
                          طلب معلومات
                        </button>
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => decide(report.id, "rejected", false)}
                          className="rounded-md bg-prohibit px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                        >
                          رفض
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-border bg-background p-2 text-[11px] text-muted-foreground">
                      القرار: {CORRECTION_DECISION_LABELS[report.decision ?? ""] ?? report.status}
                      {report.reviewed_at
                        ? ` · ${new Date(report.reviewed_at).toLocaleString("ar-SY")}`
                        : ""}
                      {report.applied ? " · طُبّق على البيانات" : " · لم يُطبّق"}
                      {report.decision_note ? ` · ${report.decision_note}` : ""}
                    </p>
                  )}
                </article>
              );
            })}
          </>
        ) : null}
      </main>
    </div>
  );
}
