import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { auditTrail } from "@/lib/network.functions";

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

const ACTION_LABELS: Record<string, string> = {
  address_created: "إنشاء عنوان",
  temporary_address_created: "عنوان مؤقت",
  business_claim_submitted: "مطالبة ملكية",
  business_claim_approved: "قبول مطالبة",
  business_claim_rejected: "رفض مطالبة",
  verification_recorded: "توثيق ميداني",
  duplicate_scan: "فحص تكرارات",
  duplicate_merged: "دمج تكرار",
  api_client_created: "عميل API جديد",
};

const FACTOR_LABELS: Record<string, string> = {
  visit_feedback: "تقييم وصول",
  correction_reported: "تقرير تصحيح",
  field_verification: "توثيق ميداني",
};

function AuditPage() {
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
          <h1 className="text-xl font-bold">يلزم تسجيل الدخول</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/audit" } })}
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
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <ScrollText className="size-5" /> سجل التدقيق
        </h1>

        {query.data && !query.data.authorized ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            سجل التدقيق متاح للمشرفين فقط.
          </p>
        ) : null}

        {query.data?.authorized ? (
          <>
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                أحداث الثقة لعنوان محدد
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
                        {FACTOR_LABELS[event.factor] ?? event.factor}
                        <span className="ms-2 text-[10px] text-muted-foreground">
                          {event.access_point_id ? "مدخل" : "عقدة"}
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
                          {new Date(event.created_at).toLocaleString("ar-SY")}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  أدخل رمز عنوان ذكي لعرض تاريخ درجة الثقة الخاص به.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                أحداث الشبكة الأخيرة ({query.data.logs.length})
              </h2>
              <div className="mt-3 space-y-1.5">
                {query.data.logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-lg border border-border bg-background p-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{ACTION_LABELS[log.action] ?? log.action}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("ar-SY")}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground" dir="ltr">
                      {log.resource_type ?? ""} {log.resource_id ?? ""}
                    </p>
                  </div>
                ))}
                {query.data.logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا أحداث مسجلة بعد.</p>
                ) : null}
              </div>
            </section>
          </>
        ) : null}

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : null}
      </main>
    </div>
  );
}
