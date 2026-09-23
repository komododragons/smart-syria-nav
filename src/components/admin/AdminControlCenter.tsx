import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, BriefcaseBusiness, Building2, CheckCircle2, ClipboardCheck,
  Database, FileClock, FileWarning, Gauge, Import, MapPinned, Search, ShieldCheck,
  Users, type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { adminControlCenter } from "@/lib/admin-control.functions";
import { GOVERNORATES } from "@/lib/smart-address";
import { PLACE_CATEGORIES } from "@/lib/place-categories";
import { useI18n, type Bilingual } from "@/lib/i18n";

type Section = "overview" | "addresses" | "businesses" | "verification" | "claims" | "corrections" | "reports" | "imports" | "api" | "organizations" | "users" | "security" | "analytics" | "health";
type Filters = { governorate: string; city: string; verification: string; category: string; status: string; from: string; to: string };

const sections: { id: Section; label: Bilingual; icon: LucideIcon; href?: "/admin/claims" | "/admin/corrections" | "/admin/navigation" | "/admin/analytics" | "/admin/audit" }[] = [
  { id: "overview", label: { ar: "نظرة عامة", en: "Overview" }, icon: Gauge },
  { id: "addresses", label: { ar: "العناوين", en: "Addresses" }, icon: MapPinned },
  { id: "businesses", label: { ar: "الأعمال", en: "Businesses" }, icon: BriefcaseBusiness },
  { id: "verification", label: { ar: "التوثيق", en: "Verification" }, icon: CheckCircle2 },
  { id: "claims", label: { ar: "المطالبات", en: "Claims" }, icon: ClipboardCheck, href: "/admin/claims" },
  { id: "corrections", label: { ar: "التصحيحات", en: "Corrections" }, icon: FileWarning, href: "/admin/corrections" },
  { id: "reports", label: { ar: "التقارير", en: "Reports" }, icon: FileClock, href: "/admin/navigation" },
  { id: "imports", label: { ar: "الاستيراد", en: "Imports" }, icon: Import },
  { id: "api", label: { ar: "استخدام API", en: "API Usage" }, icon: Activity },
  { id: "organizations", label: { ar: "المؤسسات", en: "Organizations" }, icon: Building2 },
  { id: "users", label: { ar: "المستخدمون", en: "Users" }, icon: Users },
  { id: "security", label: { ar: "الأمان", en: "Security" }, icon: ShieldCheck, href: "/admin/audit" },
  { id: "analytics", label: { ar: "التحليلات", en: "Analytics" }, icon: BarChart3, href: "/admin/analytics" },
  { id: "health", label: { ar: "صحة النظام", en: "System Health" }, icon: Database },
];

const initialFilters: Filters = { governorate: "", city: "", verification: "", category: "", status: "", from: "", to: "" };

function valueText(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.map(valueText).join("، ") || "—";
    return Object.values(value as Record<string, unknown>).map(valueText).filter((v) => v !== "—").join(" · ") || "—";
  }
  return String(value);
}

export function AdminControlCenter() {
  const { t, date } = useI18n();
  const fetchCenter = useServerFn(adminControlCenter);
  const [section, setSection] = useState<Section>("overview");
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const query = useQuery({
    queryKey: ["admin-control-center", section, filters],
    queryFn: () => fetchCenter({ data: { section, ...filters } }),
    retry: false,
  });
  const data = query.data?.authorized ? query.data : null;
  const selected = sections.find((item) => item.id === section) ?? sections[0]!;
  const update = (key: keyof Filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  const supportsPlace = section === "addresses" || section === "businesses" || section === "verification";
  const supportsCategory = section === "addresses" || section === "businesses";

  if (query.data && !query.data.authorized) {
    return <div className="border border-destructive/40 bg-prohibit-surface p-6 text-sm font-bold text-prohibit">{t({ ar: "مركز التحكم متاح للمشرفين فقط.", en: "The control center is available to administrators only." })}</div>;
  }

  return (
    <div className="grid min-h-[calc(100vh-8rem)] gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border border-border bg-header text-header-foreground lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]">
        <div className="border-b border-header-foreground/15 p-4">
          <p className="text-[10px] font-bold uppercase text-header-muted">SYRIASAN / CONTROL</p>
          <h1 className="mt-1 text-lg font-bold">{t({ ar: "مركز التحكم الإداري", en: "Admin Control Center" })}</h1>
        </div>
        <nav aria-label={t({ ar: "أقسام الإدارة", en: "Admin sections" })} className="grid grid-cols-2 gap-px overflow-y-auto p-2 sm:grid-cols-3 lg:grid-cols-1">
          {sections.map((item) => (
            <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={section === item.id ? "page" : undefined} className={`flex min-h-11 items-center gap-2 px-3 py-2 text-start text-xs font-bold transition-colors ${section === item.id ? "bg-primary text-primary-foreground" : "text-header-muted hover:bg-header-subtle hover:text-header-foreground"}`}>
              <item.icon className="size-4 shrink-0" /> {t(item.label)}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">{t({ ar: "عمليات الشبكة", en: "Network operations" })}</p>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-bold"><selected.icon className="size-5 text-primary" /> {t(selected.label)}</h2>
          </div>
          {selected.href ? <Button asChild variant="outline" size="sm"><Link to={selected.href}>{t({ ar: "فتح مساحة العمل", en: "Open workspace" })}</Link></Button> : null}
        </header>

        {section !== "overview" && section !== "health" ? (
          <section aria-label={t({ ar: "الفلاتر", en: "Filters" })} className="border border-border bg-surface p-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
              {supportsPlace ? <select aria-label={t({ ar: "المحافظة", en: "Governorate" })} value={filters.governorate} onChange={(e) => update("governorate", e.target.value)} className="h-10 border border-input bg-background px-2 text-xs"><option value="">{t({ ar: "كل المحافظات", en: "All governorates" })}</option>{GOVERNORATES.map((g) => <option key={g.code} value={g.ar}>{g.ar}</option>)}</select> : null}
              {supportsPlace ? <input aria-label={t({ ar: "المدينة", en: "City" })} value={filters.city} onChange={(e) => update("city", e.target.value)} placeholder={t({ ar: "المدينة", en: "City" })} className="h-10 border border-input bg-background px-2 text-xs" /> : null}
              {supportsPlace ? <select aria-label={t({ ar: "التوثيق", en: "Verification" })} value={filters.verification} onChange={(e) => update("verification", e.target.value)} className="h-10 border border-input bg-background px-2 text-xs"><option value="">{t({ ar: "كل مستويات التوثيق", en: "All verification" })}</option><option value="unverified">{t({ ar: "غير موثق", en: "Unverified" })}</option><option value="user_confirmed">{t({ ar: "مؤكد من المستخدم", en: "User confirmed" })}</option><option value="officially_verified">{t({ ar: "موثق رسمياً", en: "Officially verified" })}</option></select> : null}
              {supportsCategory ? <select aria-label={t({ ar: "التصنيف", en: "Category" })} value={filters.category} onChange={(e) => update("category", e.target.value)} className="h-10 border border-input bg-background px-2 text-xs"><option value="">{t({ ar: "كل التصنيفات", en: "All categories" })}</option>{PLACE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t({ ar: c.ar, en: c.en })}</option>)}</select> : null}
              <input aria-label={t({ ar: "الحالة", en: "Status" })} value={filters.status} onChange={(e) => update("status", e.target.value)} placeholder={t({ ar: "الحالة", en: "Status" })} className="h-10 border border-input bg-background px-2 text-xs" />
              <input aria-label={t({ ar: "من تاريخ", en: "From date" })} type="date" value={filters.from} onChange={(e) => update("from", e.target.value)} className="h-10 border border-input bg-background px-2 text-xs" />
              <input aria-label={t({ ar: "إلى تاريخ", en: "To date" })} type="date" value={filters.to} onChange={(e) => update("to", e.target.value)} className="h-10 border border-input bg-background px-2 text-xs" />
            </div>
            <div className="mt-2 flex justify-end"><Button variant="ghost" size="sm" onClick={() => setFilters(initialFilters)}><Search />{t({ ar: "مسح الفلاتر", en: "Clear filters" })}</Button></div>
          </section>
        ) : null}

        {query.isPending ? <p role="status" className="py-16 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ تحميل بيانات المركز…", en: "Loading control center data…" })}</p> : null}
        {query.isError ? <p role="alert" className="border border-destructive/40 bg-prohibit-surface p-4 text-sm text-prohibit">{t({ ar: "تعذّر تحميل هذا القسم.", en: "This section could not be loaded." })}</p> : null}

        {data ? (
          section === "overview" ? (
            <>
              <section className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {Object.entries(data.metrics).map(([key, value]) => <div key={key} className="border border-border bg-surface p-3"><p className="font-mono text-2xl font-bold">{Number(value).toLocaleString("en-US")}</p><p className="mt-1 text-[10px] uppercase text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p></div>)}
              </section>
              <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                <div className="border border-border bg-surface p-4"><h3 className="text-sm font-bold">{t({ ar: "آخر الإجراءات الإدارية", en: "Recent administrative actions" })}</h3><RowList rows={data.rows} date={date} empty={t({ ar: "لا نشاط مسجل.", en: "No activity recorded." })} /></div>
                <div className="border border-border bg-header p-4 text-header-foreground"><ShieldCheck className="size-5 text-primary"/><h3 className="mt-3 font-bold">{t({ ar: "الخصوصية أولاً", en: "Privacy first" })}</h3><p className="mt-2 text-xs leading-6 text-header-muted">{t({ ar: "التحليلات مجمّعة. السلوك السكني الفردي والبيانات الخاصة لا تظهر في هذا المركز.", en: "Analytics are aggregated. Individual residential behavior and private data never appear in this center." })}</p></div>
              </section>
            </>
          ) : section === "health" ? <Health rows={data.rows} t={t} /> : section === "analytics" ? <Analytics rows={data.rows} t={t} /> : <section className="overflow-hidden border border-border bg-surface"><div className="flex items-center justify-between border-b border-border px-4 py-3"><h3 className="text-sm font-bold">{t(selected.label)}</h3><span className="font-mono text-xs text-muted-foreground">{data.rows.length}</span></div><RowList rows={data.rows} date={date} empty={t({ ar: "لا نتائج تطابق الفلاتر.", en: "No results match the filters." })} /></section>
        ) : null}
      </div>
    </div>
  );
}

function RowList({ rows, date, empty }: { rows: any[]; date: (value: string | Date) => string; empty: string }) {
  if (!rows.length) return <p className="p-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return <div className="divide-y divide-border">{rows.map((row, index) => {
    const title = row.code ?? row.name_ar ?? row.full_name ?? row.filename ?? row.endpoint ?? row.action ?? row.category ?? row.id ?? `#${index + 1}`;
    const timestamp = row.created_at ?? row.resolved_at;
    const details = Object.entries(row).filter(([key]) => !["id", "code", "name_ar", "full_name", "filename", "endpoint", "action", "created_at", "resolved_at"].includes(key)).slice(0, 5);
    return <div key={row.id ?? `${title}-${index}`} className="p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 truncate text-sm font-bold">{valueText(title)}</p>{timestamp ? <time className="text-[10px] text-muted-foreground">{date(timestamp)}</time> : null}</div><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{details.map(([key, value]) => `${key.replaceAll("_", " ")}: ${valueText(value)}`).join(" · ")}</p></div>;
  })}</div>;
}

function Health({ rows, t }: { rows: any[]; t: (value: Bilingual) => string }) {
  const health = rows[0] ?? {};
  const items = [
    { label: { ar: "أخطاء API خلال 24 ساعة", en: "API errors in 24 hours" }, value: health.api_errors_24h ?? 0 },
    { label: { ar: "عمليات استيراد فاشلة", en: "Failed imports" }, value: health.failed_imports ?? 0 },
    { label: { ar: "إخفاقات مزودي الملاحة", en: "Navigation provider failures" }, value: health.provider_failures_24h ?? 0 },
  ];
  return <section className="grid gap-3 sm:grid-cols-3">{items.map((item) => { const healthy = item.value === 0; return <div key={item.label.en} className="border border-border bg-surface p-5">{healthy ? <CheckCircle2 className="size-5 text-allow" /> : <AlertTriangle className="size-5 text-prohibit" />}<p className="mt-4 font-mono text-3xl font-bold">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{t(item.label)}</p></div>; })}</section>;
}

function Analytics({ rows, t }: { rows: any[]; t: (value: Bilingual) => string }) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.event_type, (totals.get(row.event_type) ?? 0) + 1);
  return <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[...totals.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => <div key={label} className="border border-border bg-surface p-4"><BarChart3 className="size-4 text-primary"/><p className="mt-3 font-mono text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}{totals.size === 0 ? <p className="text-sm text-muted-foreground">{t({ ar: "لا أحداث في الفترة المحددة.", en: "No events in the selected period." })}</p> : null}</section>;
}