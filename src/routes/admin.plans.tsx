import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, ToggleLeft, ToggleRight } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { planAdminOverview, setAccountPlan, setEntitlementSettings } from "@/lib/plans.functions";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({
    meta: [
      { title: "إدارة الخطط — شبكة العنوان الذكي" },
      {
        name: "description",
        content: "إسناد خطط الحسابات والمؤسسات والتحكم بتفعيل حدود الخطط قبل إطلاق الأسعار.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPlansPage,
});

const card = "rounded-xl border border-border bg-surface p-4";
const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

function AdminPlansPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const fetchOverview = useServerFn(planAdminOverview);
  const assignPlan = useServerFn(setAccountPlan);
  const updateSettings = useServerFn(setEntitlementSettings);

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [subjectType, setSubjectType] = useState<"user" | "organization">("organization");
  const [subjectId, setSubjectId] = useState("");
  const [plan, setPlan] = useState<PlanId>("business");
  const [status, setStatus] = useState<"active" | "trialing" | "past_due" | "canceled">("active");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["plan-admin"],
    queryFn: () => fetchOverview(),
    enabled: signedIn === true,
  });
  const data = query.data?.authorized ? query.data : null;

  const submit = async () => {
    if (!subjectId.trim()) {
      toast.error(t({ ar: "أدخل معرّف الحساب أو المؤسسة", en: "Enter the account or organization ID" }));
      return;
    }
    setSaving(true);
    try {
      await assignPlan({
        data: {
          subject_type: subjectType,
          subject_id: subjectId.trim(),
          plan,
          status,
          source: "grant",
          notes: notes.trim() || null,
        },
      });
      toast.success(t({ ar: "تم حفظ الخطة", en: "Plan saved" }));
      setSubjectId("");
      setNotes("");
      await qc.invalidateQueries({ queryKey: ["plan-admin"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t({ ar: "تعذّر الحفظ", en: "Could not save" }));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (field: "enforced" | "pricing_published", value: boolean) => {
    try {
      await updateSettings({ data: { [field]: value } });
      await qc.invalidateQueries({ queryKey: ["plan-admin"] });
      toast.success(t({ ar: "تم التحديث", en: "Updated" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t({ ar: "تعذّر التحديث", en: "Could not update" }));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <CreditCard className="size-4 text-primary" /> {t({ ar: "إدارة الخطط", en: "Plan management" })}
        </h1>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p>
        ) : !data ? (
          <p className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t({ ar: "هذه الصفحة للمشرفين فقط.", en: "This page is for admins only." })}
          </p>
        ) : (
          <>
            <section className={card}>
              <h2 className="text-sm font-bold">{t({ ar: "إعدادات التسعير", en: "Pricing settings" })}</h2>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => toggle("enforced", !data.enforced)}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-bold"
                >
                  <span>{t({ ar: "تطبيق حدود الخطط على الإجراءات", en: "Enforce plan limits on actions" })}</span>
                  {data.enforced ? (
                    <ToggleRight className="size-5 text-primary" />
                  ) : (
                    <ToggleLeft className="size-5 text-muted-foreground" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggle("pricing_published", !data.pricing_published)}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs font-bold"
                >
                  <span>{t({ ar: "إظهار الأسعار للجمهور", en: "Show pricing to the public" })}</span>
                  {data.pricing_published ? (
                    <ToggleRight className="size-5 text-primary" />
                  ) : (
                    <ToggleLeft className="size-5 text-muted-foreground" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t({
                  ar: "ما دام التطبيق متوقفاً، تُحسب الحدود وتُعرض دون منع أي إجراء.",
                  en: "As long as enforcement is off, limits are calculated and shown without blocking any action.",
                })}
              </p>
            </section>

            <section className={card}>
              <h2 className="text-sm font-bold">{t({ ar: "إسناد خطة", en: "Assign a plan" })}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select
                  className={input}
                  value={subjectType}
                  onChange={(e) => {
                    setSubjectType(e.target.value as "user" | "organization");
                    setSubjectId("");
                  }}
                >
                  <option value="organization">{t({ ar: "مؤسسة", en: "Organization" })}</option>
                  <option value="user">{t({ ar: "مستخدم", en: "User" })}</option>
                </select>
                {subjectType === "organization" ? (
                  <select className={input} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="">{t({ ar: "اختر المؤسسة…", en: "Select organization…" })}</option>
                    {data.organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name_ar}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={input}
                    dir="ltr"
                    placeholder={t({ ar: "معرّف المستخدم (UUID)", en: "User ID (UUID)" })}
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  />
                )}
                <select className={input} value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>
                  {PLAN_ORDER.map((id) => (
                    <option key={id} value={id}>
                      {PLANS[id].name_ar}
                    </option>
                  ))}
                </select>
                <select className={input} value={status} onChange={(e) => setStatus(e.target.value as never)}>
                  <option value="active">{t({ ar: "نشط", en: "Active" })}</option>
                  <option value="trialing">{t({ ar: "تجريبي", en: "Trialing" })}</option>
                  <option value="past_due">{t({ ar: "متأخر السداد", en: "Past due" })}</option>
                  <option value="canceled">{t({ ar: "ملغى", en: "Canceled" })}</option>
                </select>
                <input
                  className={`${input} sm:col-span-2`}
                  placeholder={t({ ar: "ملاحظة داخلية (اختياري)", en: "Internal note (optional)" })}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
              >
                {saving ? t({ ar: "جارٍ الحفظ…", en: "Saving…" }) : t({ ar: "حفظ الخطة", en: "Save plan" })}
              </button>
            </section>

            <section className={card}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold">{t({ ar: "الحسابات والخطط", en: "Accounts and plans" })}</h2>
                {PLAN_ORDER.map((id) => (
                  <span key={id} className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold">
                    {PLANS[id].name_ar}: {data.counts[id] ?? 0}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {data.plans.map((row) => {
                  const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
                  return (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                    >
                      <span className="font-bold">
                        {row.subject_type === "organization"
                          ? (org?.name_ar ?? t({ ar: "مؤسسة", en: "Organization" }))
                          : t({ ar: "مستخدم", en: "User" })}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                        {row.organization_id ?? row.user_id}
                      </span>
                      <span className="ms-auto rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                        {PLANS[row.plan as PlanId]?.name_ar ?? row.plan}
                      </span>
                      <span className="text-muted-foreground">{row.status}</span>
                    </div>
                  );
                })}
                {data.plans.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t({ ar: "لم تُسنَد أي خطة بعد — الجميع على الخطة المجانية.", en: "No plan has been assigned yet — everyone is on the free plan." })}
                  </p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
