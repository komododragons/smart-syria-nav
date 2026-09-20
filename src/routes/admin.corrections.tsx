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
import { correctionDecisionLabel, correctionTypeLabel } from "@/lib/smart-address";
import { useI18n, type Bilingual } from "@/lib/i18n";

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

const FILTERS: { key: "pending" | "under_review" | "approved" | "rejected" | "all"; label: Bilingual }[] = [
  { key: "pending", label: { ar: "بانتظار المراجعة", en: "Awaiting review" } },
  { key: "under_review", label: { ar: "بحاجة لمعلومات", en: "Needs more info" } },
  { key: "approved", label: { ar: "مقبولة", en: "Approved" } },
  { key: "rejected", label: { ar: "مرفوضة", en: "Rejected" } },
  { key: "all", label: { ar: "الكل", en: "All" } },
];

type FilterKey = (typeof FILTERS)[number]["key"];

const FIELD_LABELS: Record<string, Bilingual> = {
  node_coordinates: { ar: "إحداثيات الموقع", en: "Location coordinates" },
  business_name: { ar: "اسم النشاط", en: "Business name" },
  business_status: { ar: "حالة النشاط", en: "Business status" },
  business_category: { ar: "تصنيف النشاط", en: "Business category" },
  place_category: { ar: "تصنيف المكان", en: "Place category" },
  entrance: { ar: "المدخل", en: "Entrance" },
  access: { ar: "الوصول", en: "Access" },
  other: { ar: "أخرى", en: "Other" },
};

function CorrectionsPage() {
  const { t, lang, date } = useI18n();
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
        result.applied
          ? t({ ar: "تم قبول التصحيح وتطبيقه على البيانات", en: "Correction approved and applied to the data" })
          : t({ ar: "تم تسجيل القرار في سجل المراجعة", en: "Decision logged in the review trail" }),
      );
      await query.refetch();
    } catch {
      toast.error(t({ ar: "تعذر حفظ القرار", en: "Could not save the decision" }));
    } finally {
      setBusyId(null);
    }
  };

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign-in required" })}</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/corrections" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
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
          <Flag className="size-5" /> {t({ ar: "تصحيحات المجتمع", en: "Community corrections" })}
        </h1>
        <p className="text-xs text-muted-foreground">
          {t({
            ar: "لا يُعدّل أي عنوان موثّق تلقائياً — كل تصحيح يمر بقرار مراجع، ويُسجَّل الأصل والمقترح والمراجع والقرار ووقته.",
            en: "No verified address is ever edited automatically — every correction goes through a reviewer decision, and the original, suggestion, reviewer, decision, and timestamp are all logged.",
          })}
        </p>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p>
        ) : null}

        {query.data && !query.data.authorized ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t({ ar: "مراجعة التصحيحات متاحة للمشرفين والمراجعين فقط.", en: "Correction review is available to admins and reviewers only." })}
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
                  {t(item.label)}
                  {data.counts[item.key] != null ? ` (${data.counts[item.key]})` : ""}
                </button>
              ))}
            </div>

            {data.reports.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
                {t({ ar: "لا تصحيحات في هذه القائمة.", en: "No corrections in this list." })}
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
                        {correctionTypeLabel(report.issue_type, lang)}
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
                      {date(report.created_at)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-background p-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t({ ar: "القيمة الحالية", en: "Current value" })} · {FIELD_LABELS[report.target_field ?? "other"] ? t(FIELD_LABELS[report.target_field ?? "other"]) : report.target_field}
                      </p>
                      <p className="mt-1 text-xs">{report.original_value ?? t({ ar: "غير مسجّلة", en: "Not recorded" })}</p>
                    </div>
                    <div className="rounded-lg border border-primary/40 bg-background p-2">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t({ ar: "التعديل المقترح", en: "Suggested change" })}
                      </p>
                      <p className="mt-1 text-xs font-bold">{report.suggested_value ?? t({ ar: "بدون قيمة محددة", en: "No specific value" })}</p>
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
                        placeholder={t({ ar: "ملاحظة المراجع (اختياري)", en: "Reviewer note (optional)" })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => decide(report.id, "approved", true)}
                          className="rounded-md bg-allow px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                        >
                          {t({ ar: "قبول وتطبيق", en: "Approve & apply" })}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => decide(report.id, "approved", false)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50"
                        >
                          {t({ ar: "قبول دون تطبيق", en: "Approve without applying" })}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => decide(report.id, "needs_more_info", false)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground disabled:opacity-50"
                        >
                          {t({ ar: "طلب معلومات", en: "Request more info" })}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === report.id}
                          onClick={() => decide(report.id, "rejected", false)}
                          className="rounded-md bg-prohibit px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                        >
                          {t({ ar: "رفض", en: "Reject" })}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-border bg-background p-2 text-[11px] text-muted-foreground">
                      {t({ ar: "القرار", en: "Decision" })}: {report.decision ? correctionDecisionLabel(report.decision, lang) : report.status}
                      {report.reviewed_at
                        ? ` · ${date(report.reviewed_at)}`
                        : ""}
                      {report.applied
                        ? ` · ${t({ ar: "طُبّق على البيانات", en: "Applied to the data" })}`
                        : ` · ${t({ ar: "لم يُطبّق", en: "Not applied" })}`}
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
