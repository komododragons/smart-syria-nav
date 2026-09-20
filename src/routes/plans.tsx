import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Minus, Sparkles } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { myEntitlements } from "@/lib/plans.functions";
import {
  ENTITLEMENT_LABELS_AR,
  LIMIT_LABELS_AR,
  PLANS,
  PLAN_ORDER,
  formatLimit,
  type LimitKey,
} from "@/lib/plans";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "الخطط والاشتراكات — شبكة العنوان الذكي" },
      {
        name: "description",
        content:
          "العنونة الشخصية وحلّ العناوين والمشاركة ورموز QR مجانية دائماً. خطط الأعمال والمطوّرين والمؤسسات تضيف التوثيق والفروع والتحليلات والواجهة البرمجية والتكاملات المخصصة.",
      },
      { property: "og:title", content: "خطط شبكة العنوان الذكي" },
      {
        property: "og:description",
        content: "العنونة الشخصية مجانية دائماً — وخطط للأعمال والمطوّرين والمؤسسات.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlansPage,
});

const LIMIT_ROWS: LimitKey[] = [
  "locations",
  "team_members",
  "api_keys",
  "api_rate_per_minute",
  "bulk_import_rows",
  "webhooks",
  "analytics_days",
];

function PlansPage() {
  const fetchEntitlements = useServerFn(myEntitlements);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  const mine = useQuery({
    queryKey: ["my-entitlements"],
    queryFn: () => fetchEntitlements({ data: {} }),
    enabled: signedIn,
  });

  const currentPlan = mine.data?.plan ?? null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h1 className="text-xl font-bold">الخطط</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            إنشاء العنوان الشخصي وحلّ العناوين والمشاركة ورموز QR مجانية دائماً ولن تُسعَّر. الخطط الأخرى
            مخصّصة للأعمال والمطوّرين والمؤسسات.
          </p>
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[12px] font-bold text-primary">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" />
            الأسعار لم تُعلَن بعد. هذه الصفحة تعرض ما تشمله كل خطة فقط.
          </p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const active = currentPlan === id;
            return (
              <section
                key={id}
                className={`rounded-xl border p-4 ${
                  active ? "border-primary bg-primary/5" : "border-border bg-surface"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold">{plan.name_ar}</h2>
                  {active ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      خطتك الحالية
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
                      {plan.name_en}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{plan.tagline_ar}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{plan.audience_ar}</p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {plan.entitlements.map((ent) => (
                    <li key={ent} className="flex items-start gap-1.5 text-[12px]">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {ENTITLEMENT_LABELS_AR[ent]}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <section className="overflow-x-auto rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">الحدود</h2>
          <table className="mt-3 w-full text-[12px]">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-2 text-start font-bold">البند</th>
                {PLAN_ORDER.map((id) => (
                  <th key={id} className="p-2 text-center font-bold">
                    {PLANS[id].name_ar}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIMIT_ROWS.map((key) => (
                <tr key={key} className="border-t border-border">
                  <td className="p-2 font-bold">{LIMIT_LABELS_AR[key]}</td>
                  {PLAN_ORDER.map((id) => {
                    const value = PLANS[id].limits[key];
                    return (
                      <td key={id} className="p-2 text-center font-mono">
                        {value === 0 ? <Minus className="mx-auto size-3.5 text-muted-foreground" /> : formatLimit(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {mine.data ? (
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-bold">استخدامك الحالي</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["locations", mine.data.usage.locations],
                  ["team_members", mine.data.usage.team_members],
                  ["api_keys", mine.data.usage.api_keys],
                  ["webhooks", mine.data.usage.webhooks],
                ] as [LimitKey, number][]
              ).map(([key, used]) => (
                <div key={key} className="rounded-lg border border-border p-3 text-center">
                  <p className="font-mono text-lg font-bold">
                    {used}
                    <span className="text-xs text-muted-foreground">
                      {" / "}
                      {formatLimit(PLANS[mine.data!.plan].limits[key])}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{LIMIT_LABELS_AR[key]}</p>
                </div>
              ))}
            </div>
            {!mine.data.enforced ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                الحدود معروضة للاطلاع فقط في الوقت الحالي ولا تمنع أي إجراء.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-surface p-4 text-center">
            <p className="text-sm text-muted-foreground">سجّل الدخول لرؤية خطتك واستخدامك.</p>
            <Link
              to="/auth"
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              الدخول
            </Link>
          </section>
        )}

        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          للاهتمام بخطة المؤسسات أو تكامل مخصص، تواصل معنا عبر{" "}
          <Link to="/developers" className="font-bold text-primary">
            صفحة المطوّرين
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
