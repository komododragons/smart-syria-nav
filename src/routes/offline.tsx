import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CloudDownload,
  CloudOff,
  Download,
  MapPin,
  RefreshCw,
  Trash2,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { useOnline } from "@/hooks/use-online";
import { fetchRegionPackage, REGION_PACKAGES } from "@/lib/offline.functions";
import {
  forgetAddress,
  readPackages,
  readRecentAddresses,
  removePackage,
  savePackage,
  type CachedAddress,
  type CachedPackage,
} from "@/lib/offline/store";

export const Route = createFileRoute("/offline")({
  head: () => ({
    meta: [
      { title: "العمل دون اتصال — سيرياسان" },
      {
        name: "description",
        content:
          "العناوين المحفوظة على جهازك وحِزم المحافظات القابلة للتنزيل، لتصفح العناوين الذكية عند انقطاع الإنترنت.",
      },
      { property: "og:title", content: "العمل دون اتصال — سيرياسان" },
      {
        property: "og:description",
        content: "احفظ عناوين المحافظات على جهازك واستخدمها عند انقطاع الاتصال.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfflinePage,
});

function OfflinePage() {
  const online = useOnline();
  const [recent, setRecent] = useState<CachedAddress[]>([]);
  const [packages, setPackages] = useState<CachedPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setRecent(readRecentAddresses());
    setPackages(readPackages());
  }, []);

  const download = async (region: string) => {
    setBusy(region);
    try {
      const pkg = await fetchRegionPackage({ data: { region, limit: 300 } });
      savePackage(pkg);
      setPackages(readPackages());
      toast.success(`تم حفظ ${pkg.entries.length} عنواناً من ${pkg.region_ar} على جهازك`);
    } catch {
      toast.error("تعذر تنزيل حزمة المحافظة — تحقق من الاتصال");
    } finally {
      setBusy(null);
    }
  };

  const total = recent.length + packages.reduce((sum, p) => sum + p.entries.length, 0);

  return (
    <div className="min-h-screen bg-secondary">
      <AppHeader />
      <main className="mx-auto max-w-3xl space-y-4 p-4">
        <header className="rounded-2xl border border-border bg-background p-5">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {online ? <Wifi className="size-3.5 text-primary" /> : <CloudOff className="size-3.5" />}
            {online ? "متصل" : "دون اتصال"}
          </span>
          <h1 className="mt-1 text-xl font-bold">العمل دون اتصال</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            يحفظ سيرياسان واجهة التطبيق والعناوين التي فتحتها مؤخراً على جهازك، ويمكنك تنزيل حزمة
            عناوين لأي محافظة. عند انقطاع الإنترنت تُعرض هذه النسخة المحلية، وقد تكون حالة التوثيق
            وساعات العمل ومعلومات المسار غير محدّثة.
          </p>
          <p className="mt-2 text-xs font-bold">
            محفوظ حالياً على هذا الجهاز: {total} عنواناً
          </p>
        </header>

        <section className="rounded-2xl border border-border bg-background p-5">
          <h2 className="text-sm font-bold">حِزم المحافظات</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            الحزمة الحالية تضم العناوين الذكية العامة للمحافظة (بدون العناوين السكنية الخاصة). خرائط
            الطرق الكاملة ستُضاف لاحقاً إلى الحزمة نفسها.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {REGION_PACKAGES.map((region) => {
              const saved = packages.find((p) => p.region === region.code);
              return (
                <div
                  key={region.code}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <div className="min-w-0">
                    <span className="block text-sm font-bold">{region.ar}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {saved
                        ? `${saved.entries.length} عنوان · حُدّثت ${new Date(saved.cached_at).toLocaleDateString("ar")}`
                        : "غير منزّلة"}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={!online || busy === region.code}
                      onClick={() => void download(region.code)}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs font-bold disabled:opacity-40"
                    >
                      {busy === region.code ? (
                        <RefreshCw className="size-3.5 animate-spin" />
                      ) : saved ? (
                        <RefreshCw className="size-3.5" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      {saved ? "تحديث" : "تنزيل"}
                    </button>
                    {saved ? (
                      <button
                        type="button"
                        aria-label={`حذف حزمة ${region.ar}`}
                        onClick={() => {
                          removePackage(region.code);
                          setPackages(readPackages());
                        }}
                        className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          {!online ? (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-destructive">
              <CloudOff className="size-3.5" />
              التنزيل يحتاج اتصالاً بالإنترنت.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-background p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <CloudDownload className="size-4 text-primary" />
            عناوين فتحتها مؤخراً
          </h2>
          {recent.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              لم تُحفظ عناوين بعد — كل عنوان ذكي تفتحه يُحفظ تلقائياً هنا لاستخدامه دون اتصال.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recent.map((entry) => (
                <li
                  key={entry.code}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <Link
                    to="/a/$code"
                    params={{ code: entry.code }}
                    className="min-w-0 flex-1"
                  >
                    <span className="block font-mono text-xs font-bold text-primary" dir="ltr">
                      {entry.code}
                    </span>
                    <span className="block truncate text-sm font-bold">{entry.display_name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {[entry.neighborhood, entry.city, entry.governorate].filter(Boolean).join(" — ")}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`حذف ${entry.code}`}
                    onClick={() => {
                      forgetAddress(entry.code);
                      setRecent(readRecentAddresses());
                    }}
                    className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="flex items-start gap-2 rounded-2xl border border-border bg-background p-4 text-[11px] leading-relaxed text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
          للاستخدام دون اتصال على الهاتف: افتح سيرياسان في المتصفح ثم «إضافة إلى الشاشة الرئيسية».
          العمل دون اتصال يعمل في النسخة المنشورة من الموقع، لا داخل محرر المعاينة.
        </p>

        <Link
          to="/"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold"
        >
          <MapPin className="size-4" />
          العودة إلى الخريطة
        </Link>
      </main>
    </div>
  );
}
