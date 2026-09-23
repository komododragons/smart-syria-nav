import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { BarChart3, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { platformAnalytics } from "@/lib/analytics.functions";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign in required" })}</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin/analytics" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
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
            <BarChart3 className="size-4 text-primary" /> {t({ ar: "تحليلات الشبكة", en: "Network analytics" })}
          </h1>
          <select
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>{t({ ar: "آخر 7 أيام", en: "Last 7 days" })}</option>
            <option value={30}>{t({ ar: "آخر 30 يوماً", en: "Last 30 days" })}</option>
            <option value={90}>{t({ ar: "آخر 90 يوماً", en: "Last 90 days" })}</option>
          </select>
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {t({
            ar: "كل الأرقام مجمّعة ومجهولة الهوية. لا تُسجَّل هوية أي مستخدم، ولا تظهر العناوين السكنية الخاصة في أي تفصيل.",
            en: "All figures are aggregated and anonymized. No user identity is recorded, and no private residential address appears in any breakdown.",
          })}
        </p>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "هذه الصفحة للمشرفين فقط.", en: "This page is for admins only." })}</p>
        ) : (
          <>
            <section className={card}>
              <h2 className="text-sm font-bold">{t({ ar: "حالة الشبكة", en: "Network status" })}</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label={t({ ar: "عناوين نشطة", en: "Active addresses" })} value={data.network.active_addresses} />
                <Stat label={t({ ar: "عناوين موثقة", en: "Verified addresses" })} value={data.network.verified_addresses} />
                <Stat label={t({ ar: "مواقع أعمال", en: "Business locations" })} value={data.network.business_locations} />
                <Stat
                  label={t({ ar: "عناوين أُنشئت", en: "Addresses created" })}
                  value={data.network.addresses_created}
                  hint={t({ ar: `آخر ${data.days} يوماً`, en: `Last ${data.days} days` })}
                />
                <Stat
                  label={t({ ar: "مواقع أُنشئت", en: "Locations created" })}
                  value={data.network.locations_created}
                  hint={t({ ar: `آخر ${data.days} يوماً`, en: `Last ${data.days} days` })}
                />
                <Stat
                  label={t({ ar: "تصحيحات مُرسَلة", en: "Corrections submitted" })}
                  value={data.usage.corrections_submitted}
                  hint={t({ ar: `آخر ${data.days} يوماً`, en: `Last ${data.days} days` })}
                />
              </div>
            </section>

            <section className={card}>
              <h2 className="text-sm font-bold">
                {t({ ar: `الاستخدام خلال آخر ${data.days} يوماً`, en: `Usage over the last ${data.days} days` })}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat label={t({ ar: "عمليات حلّ العنوان", en: "Address resolutions" })} value={data.usage.resolve} />
                <Stat label={t({ ar: "مسح رموز QR", en: "QR scans" })} value={data.usage.qr_scan} />
                <Stat label={t({ ar: "بدء التوجيه", en: "Navigation starts" })} value={data.usage.navigate_start} />
                <Stat
                  label={t({ ar: "فتح وضع التوصيل", en: "Delivery mode opens" })}
                  value={data.usage.delivery_view}
                  hint={t({ ar: `${data.usage.delivery_share}% من نية التوجيه`, en: `${data.usage.delivery_share}% of navigation intent` })}
                />
                <Stat label={t({ ar: "ظهور في البحث", en: "Search appearances" })} value={data.usage.search_appearance} />
                <Stat label={t({ ar: "طلبات الواجهة البرمجية", en: "API requests" })} value={data.usage.api_requests} />
                <Stat label={t({ ar: "حلّ العنوان عبر API", en: "API address resolutions" })} value={data.usage.api_address_resolutions} />
                <Stat label={t({ ar: "استخدام متكرر للعناوين", en: "Repeat address usage" })} value={data.usage.repeat_address_usage} />
                <Stat label={t({ ar: "تصحيحات ناجحة", en: "Successful corrections" })} value={data.usage.successful_corrections} />
                <Stat label={t({ ar: "عناوين استخدمتها تطبيقات خارجية", en: "Addresses used by external apps" })} value={data.usage.external_application_addresses} />
              </div>
            </section>

            <section className="border border-primary/40 bg-header p-5 text-header-foreground">
              <p className="text-[10px] font-bold uppercase text-header-muted">NORTH STAR</p>
              <p className="mt-2 font-mono text-4xl font-bold text-primary">{data.usage.successful_destinations_reached.toLocaleString("en-US")}</p>
              <h2 className="mt-2 text-sm font-bold">{t({ ar: "وجهات ناجحة تم الوصول إليها باستخدام عنوان سيرياسان", en: "Successful destinations reached using a Syriasan address" })}</h2>
              <p className="mt-1 text-xs text-header-muted">{t({ ar: "تأكيدات وصول مجهولة ومزالة التكرار حسب رحلة التكامل.", en: "Anonymous arrival confirmations deduplicated by integration journey." })}</p>
            </section>

            <section className={card}>
              <h2 className="text-sm font-bold">{t({ ar: "النشاط اليومي", en: "Daily activity" })}</h2>
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
                {t({
                  ar: `الذروة: ${peak} حدثاً في اليوم · إجمالي الأحداث المسجّلة في الفترة: ${data.series.reduce((sum, s) => sum + s.count, 0)}`,
                  en: `Peak: ${peak} events in a day · Total events logged in this period: ${data.series.reduce((sum, s) => sum + s.count, 0)}`,
                })}
              </p>
            </section>

            <section className={card}>
              <h2 className="text-sm font-bold">{t({ ar: "الأكثر استخداماً (عناوين عامة فقط)", en: "Most used (public addresses only)" })}</h2>
              <div className="mt-3 flex flex-col gap-2">
                {data.top_addresses.map((row) => (
                  <div key={row.code} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                    <span className="font-bold">{row.label || t({ ar: "موقع عام", en: "Public location" })}</span>
                    <span className="font-mono text-muted-foreground" dir="ltr">
                      {row.code}
                    </span>
                    <span className="ms-auto font-mono font-bold">{row.count}</span>
                  </div>
                ))}
                {data.top_addresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t({ ar: "لا يوجد نشاط كافٍ في هذه الفترة.", en: "Not enough activity in this period." })}</p>
                ) : null}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
