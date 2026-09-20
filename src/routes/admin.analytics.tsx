import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BarChart3, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { platformAnalytics } from "@/lib/analytics.functions";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({
    meta: [
      { title: "تحليلات الشبكة — سيرياسان" },
      {
        name: "description",
        content:
          "مؤشرات مجمّعة للشبكة: العناوين النشطة والموثقة، مواقع الأعمال، عمليات الحل، مسح QR، بدء التوجيه، طلبات الواجهة البرمجية، وضع التوصيل، والتصحيحات.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AnalyticsPage,
});

const card = "rounded-xl border border-border bg-surface p-4";

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="font-mono text-xl font-bold">{typeof value === "number" ? value.toLocaleString("en-US") : value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function AnalyticsPage() {
  const navigate = useNavigate();
  const fetchStats = useServerFn(platformAnalytics);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["platform-analytics", days],
    queryFn: () => fetchStats({ data: { days } }),
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
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/analytics" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            الدخول
          </button>
        </main>
      </div>
    );
  }

  const data = query.data?.authorized ? query.data : null;
  const peak = Math.max(1, ...(data?.series ?? []).map((s) => s.count));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <BarChart3 className="size-4 text-primary" /> تحليلات الشبكة
          </h1>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>آخر 7 أيام</option>
            <option value={30}>آخر 30 يوماً</option>
            <option value={90}>آخر 90 يوماً</option>
          </select>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          كل الأرقام مجمّعة ومجهولة الهوية. لا تُسجَّل هوية أي مستخدم، ولا تظهر العناوين السكنية الخاصة في أي تفصيل.
        </p>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">هذه الصفحة للمشرفين فقط.</p>
        ) : (
          <>
            <section className={card}>
              <h2 className="text-sm font-bold">حالة الشبكة</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="عناوين نشطة" value={data.network.active_addresses} />
                <Stat label="عناوين موثقة" value={data.network.verified_addresses} />
                <Stat label="مواقع أعمال" value={data.network.business_locations} />
                <Stat label="عناوين أُنشئت" value={data.network.addresses_created} hint={`آخر ${data.days} يوماً`} />
                <Stat label="مواقع أُنشئت" value={data.network.locations_created} hint={`آخر ${data.days} يوماً`} />
                <Stat label="تصحيحات مُرسَلة" value={data.usage.corrections_submitted} hint={`آخر ${data.days} يوماً`} />
              </div>
            </section>

            <section className={card}>
              <h2 className="text-sm font-bold">الاستخدام خلال آخر {data.days} يوماً</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label="عمليات حلّ العنوان" value={data.usage.resolve} />
                <Stat label="مسح رموز QR" value={data.usage.qr_scan} />
                <Stat label="بدء التوجيه" value={data.usage.navigate_start} />
                <Stat label="فتح وضع التوصيل" value={data.usage.delivery_view} hint={`${data.usage.delivery_share}% من نية التوجيه`} />
                <Stat label="ظهور في البحث" value={data.usage.search_appearance} />
                <Stat label="طلبات الواجهة البرمجية" value={data.usage.api_requests} />
              </div>
            </section>

            <section className={card}>
              <h2 className="text-sm font-bold">النشاط اليومي</h2>
              <div className="mt-3 flex h-28 items-end gap-0.5" dir="ltr">
                {data.series.map((point) => (
                  <div
                    key={point.day}
                    title={`${point.day}: ${point.count}`}
                    className="flex-1 rounded-t bg-primary/70"
                    style={{ height: `${Math.max(2, (point.count / peak) * 100)}%` }}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                الذروة: {peak} حدثاً في اليوم · إجمالي الأحداث المسجّلة في الفترة:{" "}
                {data.series.reduce((sum, s) => sum + s.count, 0)}
              </p>
            </section>

            <section className={card}>
              <h2 className="text-sm font-bold">الأكثر استخداماً (عناوين عامة فقط)</h2>
              <div className="mt-3 flex flex-col gap-2">
                {data.top_addresses.map((row) => (
                  <div key={row.code} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                    <span className="font-bold">{row.label || "موقع عام"}</span>
                    <span className="font-mono text-muted-foreground" dir="ltr">
                      {row.code}
                    </span>
                    <span className="ms-auto font-mono font-bold">{row.count}</span>
                  </div>
                ))}
                {data.top_addresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا يوجد نشاط كافٍ في هذه الفترة.</p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
