import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Flag } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { myCorrections } from "@/lib/corrections.functions";
import { correctionDecisionLabel, correctionTypeLabel } from "@/lib/smart-address";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/my-corrections")({
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

function statusLabel(status: string, t: (v: { ar: string; en: string }) => string) {
  const map: Record<string, { ar: string; en: string }> = {
    pending: { ar: "بانتظار المراجعة", en: "Awaiting review" },
    reviewed: { ar: "بانتظار المراجعة", en: "Awaiting review" },
    under_review: { ar: "بحاجة لمعلومات إضافية", en: "Needs more information" },
    approved: { ar: "مقبول", en: "Approved" },
    rejected: { ar: "مرفوض", en: "Rejected" },
    dismissed: { ar: "مرفوض", en: "Rejected" },
  };
  return map[status] ? t(map[status]) : status;
}

function MyCorrectionsPage() {
  const navigate = useNavigate();
  const listFn = useServerFn(myCorrections);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { t, lang, date } = useI18n();

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
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign in required" })}</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/my-corrections" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
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
          <Flag className="size-5" /> {t({ ar: "تصحيحاتي", en: "My corrections" })}
        </h1>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t({ ar: "جارٍ التحميل…", en: "Loading…" })}
          </p>
        ) : null}

        {query.data?.reports.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t({ ar: "لم ترسل أي بلاغ تصحيح بعد.", en: "You haven't submitted any correction reports yet." })}
          </p>
        ) : null}

        {(query.data?.reports ?? []).map((report) => (
          <article key={report.id} className="rounded-2xl border border-border bg-surface p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{correctionTypeLabel(report.issue_type, lang)}</p>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px]">
                {statusLabel(report.status, t)}
              </span>
            </div>
            {report.smart_code ? (
              <p className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">
                {report.smart_code}
              </p>
            ) : null}
            {report.suggested_value ? (
              <p className="mt-2 text-muted-foreground">
                {t({ ar: "اقتراحك:", en: "Your suggestion:" })}{" "}
                <span className="font-bold text-foreground">{report.suggested_value}</span>
              </p>
            ) : null}
            {report.details ? <p className="mt-1 text-muted-foreground">{report.details}</p> : null}
            <p className="mt-2 text-[10px] text-muted-foreground">
              {t({ ar: "أُرسل", en: "Submitted" })} {date(report.created_at)}
              {report.reviewed_at ? ` · ${t({ ar: "روجع", en: "Reviewed" })} ${date(report.reviewed_at)}` : ""}
              {report.decision ? ` · ${correctionDecisionLabel(report.decision, lang)}` : ""}
              {report.applied ? ` · ${t({ ar: "طُبّق التعديل", en: "Change applied" })}` : ""}
            </p>
            {report.decision_note ? (
              <p className="mt-1 rounded-lg border border-border bg-background p-2 text-[11px]">
                {t({ ar: "ملاحظة المراجع:", en: "Reviewer note:" })} {report.decision_note}
              </p>
            ) : null}
          </article>
        ))}
      </main>
    </div>
  );
}
