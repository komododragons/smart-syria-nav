import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { auditTrail } from "@/lib/network.functions";
import { useI18n, type Bilingual } from "@/lib/i18n";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({
    meta: [
      { title: "سجل التدقيق الكامل" },
      {
        name: "description",
        content: "سجل أحداث الشبكة: الإنشاء، التوثيق، الدمج، وأحداث درجة الثقة لكل عنوان.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuditPage,
});

const ACTION_LABELS: Record<string, Bilingual> = {
  address_created: { ar: "إنشاء عنوان", en: "Address created" },
  temporary_address_created: { ar: "عنوان مؤقت", en: "Temporary address" },
  business_claim_submitted: { ar: "مطالبة ملكية", en: "Ownership claim submitted" },
  business_claim_approved: { ar: "قبول مطالبة", en: "Claim approved" },
  business_claim_rejected: { ar: "رفض مطالبة", en: "Claim rejected" },
  verification_recorded: { ar: "توثيق ميداني", en: "Field verification" },
  duplicate_scan: { ar: "فحص تكرارات", en: "Duplicate scan" },
  duplicate_merged: { ar: "دمج تكرار", en: "Duplicate merged" },
  api_client_created: { ar: "عميل API جديد", en: "New API client" },
};

const FACTOR_LABELS: Record<string, Bilingual> = {
  visit_feedback: { ar: "تقييم وصول", en: "Arrival feedback" },
  correction_reported: { ar: "تقرير تصحيح", en: "Correction report" },
  field_verification: { ar: "توثيق ميداني", en: "Field verification" },
};

function AuditPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const auditFn = useServerFn(auditTrail);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["audit-trail", code],
    queryFn: () => auditFn({ data: { code: code || undefined } }),
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
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/audit" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
          </button>
        </main>
      </div>
    );
  }

  const localeTag = lang === "ar" ? "ar-SY" : "en-US";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <ScrollText className="size-5" /> {t({ ar: "سجل التدقيق", en: "Audit log" })}
        </h1>

        {query.data && !query.data.authorized ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t({ ar: "سجل التدقيق متاح للمشرفين فقط.", en: "The audit log is available to admins only." })}
          </p>
        ) : null}

        {query.data?.authorized ? (
          <>
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t({ ar: "أحداث الثقة لعنوان محدد", en: "Trust events for a specific address" })}
              </h2>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="SY-DAM-K7X4"
                dir="ltr"
                className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none"
              />
              {query.data.events.length ? (
                <div className="mt-3 space-y-1.5">
                  {query.data.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background p-2 text-xs"
                    >
                      <span>
                        {FACTOR_LABELS[event.factor] ? t(FACTOR_LABELS[event.factor]) : event.factor}
                        <span className="ms-2 text-[10px] text-muted-foreground">
                          {event.access_point_id ? t({ ar: "مدخل", en: "Entry point" }) : t({ ar: "عقدة", en: "Node" })}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold ${event.delta >= 0 ? "text-allow" : "text-prohibit"}`}
                          dir="ltr"
                        >
                          {event.delta >= 0 ? "+" : ""}
                          {event.delta}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(event.created_at).toLocaleString(localeTag)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {t({ ar: "أدخل رمز عنوان ذكي لعرض تاريخ درجة الثقة الخاص به.", en: "Enter a smart address code to view its trust score history." })}
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t({ ar: `أحداث الشبكة الأخيرة (${query.data.logs.length})`, en: `Recent network events (${query.data.logs.length})` })}
              </h2>
              <div className="mt-3 space-y-1.5">
                {query.data.logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border bg-background p-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{ACTION_LABELS[log.action] ? t(ACTION_LABELS[log.action]) : log.action}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString(localeTag)}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
                      {log.resource_type ?? ""} {log.resource_id ?? ""}
                    </p>
                  </div>
                ))}
                {query.data.logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t({ ar: "لا أحداث مسجلة بعد.", en: "No events logged yet." })}</p>
                ) : null}
              </div>
            </section>
          </>
        ) : null}

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p>
        ) : null}
      </main>
    </div>
  );
}
