import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Flag } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { myCorrections } from "@/lib/corrections.functions";
import { CORRECTION_DECISION_LABELS, CORRECTION_TYPE_LABELS } from "@/lib/smart-address";

export const Route = createFileRoute("/my-corrections")({
  head: () => ({
    meta: [
      { title: "تصحيحاتي — سيرياسان" },
      {
        name: "description",
        content: "تابع بلاغات التصحيح التي أرسلتها وحالة مراجعتها وقرار المراجع.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyCorrectionsPage,
});

const STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار المراجعة",
  reviewed: "بانتظار المراجعة",
  under_review: "بحاجة لمعلومات إضافية",
  approved: "مقبول",
  rejected: "مرفوض",
  dismissed: "مرفوض",
};

function MyCorrectionsPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(myCorrections);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["my-corrections"],
    queryFn: () => listFn({ data: undefined as never }),
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
            onClick={() => navigate({ to: "/auth", search: { redirect: "/my-corrections" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            الدخول
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-2xl flex-col gap-3 px-4 py-6">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Flag className="size-5" /> تصحيحاتي
        </h1>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : null}

        {query.data?.reports.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            لم ترسل أي بلاغ تصحيح بعد.
          </p>
        ) : null}

        {(query.data?.reports ?? []).map((report) => (
          <article key={report.id} className="rounded-2xl border border-border bg-surface p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">
                {CORRECTION_TYPE_LABELS[report.issue_type] ?? report.issue_type}
              </p>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">
                {STATUS_LABELS[report.status] ?? report.status}
              </span>
            </div>
            {report.smart_code ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">
                {report.smart_code}
              </p>
            ) : null}
            {report.suggested_value ? (
              <p className="mt-2 text-muted-foreground">
                اقتراحك: <span className="font-bold text-foreground">{report.suggested_value}</span>
              </p>
            ) : null}
            {report.details ? <p className="mt-1 text-muted-foreground">{report.details}</p> : null}
            <p className="mt-2 text-[10px] text-muted-foreground">
              أُرسل {new Date(report.created_at).toLocaleString("ar-SY")}
              {report.reviewed_at
                ? ` · روجع ${new Date(report.reviewed_at).toLocaleString("ar-SY")}`
                : ""}
              {report.decision
                ? ` · ${CORRECTION_DECISION_LABELS[report.decision] ?? report.decision}`
                : ""}
              {report.applied ? " · طُبّق التعديل" : ""}
            </p>
            {report.decision_note ? (
              <p className="mt-1 rounded-lg border border-border bg-background p-2 text-[11px]">
                ملاحظة المراجع: {report.decision_note}
              </p>
            ) : null}
          </article>
        ))}
      </main>
    </div>
  );
}
