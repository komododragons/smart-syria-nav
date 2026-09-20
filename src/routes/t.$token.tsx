import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, Navigation } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { CadastralMap } from "@/components/CadastralMap";
import { resolveTemporaryToken } from "@/lib/addresses.functions";
import { NODE_TYPE_LABELS, PURPOSE_LABELS, formatCoords, osmDirectionsUrl } from "@/lib/smart-address";

export const Route = createFileRoute("/t/$token")({
  head: () => ({
    meta: [
      { title: "عنوان مؤقت | شبكة العنوان الذكي" },
      {
        name: "description",
        content: "وصول محدود المدة والغرض إلى عنوان خاص، بدون كشف بيانات صاحب العنوان.",
      },
      { property: "og:title", content: "عنوان مؤقت — الشبكة السورية" },
      { property: "og:description", content: "رمز مؤقت ينتهي تلقائياً ويكشف الوجهة فقط." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TempPage,
});

function TempPage() {
  const { token } = Route.useParams();
  const resolve = useServerFn(resolveTemporaryToken);
  const query = useQuery({
    queryKey: ["temp", token],
    queryFn: () => resolve({ data: { token } }),
  });

  const data = query.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {query.isPending ? (
          <p className="py-12 text-center text-sm text-muted-foreground">جارٍ التحقق…</p>
        ) : null}

        {data && data.status !== "ok" ? (
          <section className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="font-bold">
              {data.status === "expired"
                ? "انتهت صلاحية هذا الرمز المؤقت"
                : data.status === "revoked"
                  ? "تم إلغاء هذا الرمز"
                  : "رمز غير معروف"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              اطلب رمزاً جديداً من صاحب العنوان. الرموز المؤقتة تنتهي تلقائياً لحماية الخصوصية.
            </p>
          </section>
        ) : null}

        {data?.status === "ok" ? (
          <>
            <section className="animate-entrance rounded-2xl border border-primary/40 bg-primary/5 p-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                وصول مؤقت — {PURPOSE_LABELS[data.purpose] ?? data.purpose}
              </span>
              <h1 className="text-xl font-bold">{data.site?.display_name ?? "الوجهة"}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3" />
                ينتهي: {new Date(data.expires_at).toLocaleString("ar-SY")}
              </p>
            </section>

            {data.site?.latitude != null && data.site.longitude != null ? (
              <CadastralMap
                center={{ latitude: data.site.latitude, longitude: data.site.longitude }}
                pins={[
                  {
                    id: "dest",
                    latitude: data.access_point?.latitude ?? data.site.latitude,
                    longitude: data.access_point?.longitude ?? data.site.longitude,
                    label: data.access_point?.display_name ?? data.site.display_name,
                    tone: "recommended",
                  },
                ]}
              />
            ) : null}

            <section className="animate-entrance rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                الوجهة
              </h2>
              <div className="mt-2 space-y-1 text-sm">
                {data.chain.map((level, index) => (
                  <p key={`${level.node_type}-${index}`}>
                    <span className="text-muted-foreground">
                      {NODE_TYPE_LABELS[level.node_type] ?? level.node_type}:
                    </span>{" "}
                    <strong>{level.label}</strong>
                  </p>
                ))}
              </div>
              {data.access_point?.instructions_ar ? (
                <p className="mt-3 rounded-lg border border-border bg-background p-3 text-sm">
                  {data.access_point.instructions_ar}
                </p>
              ) : null}
              {data.access_point?.parking_info ?? data.site?.parking_info ? (
                <p className="mt-2 rounded-lg border border-border bg-background p-3 text-sm">
                  المواقف: {data.access_point?.parking_info ?? data.site?.parking_info}
                </p>
              ) : null}
              {data.contact_name || data.contact_phone ? (
                <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                  {data.contact_name ? <p className="font-bold">{data.contact_name}</p> : null}
                  {data.contact_phone ? (
                    <a
                      href={`tel:${data.contact_phone}`}
                      dir="ltr"
                      className="mt-1 block font-mono font-bold text-primary"
                    >
                      {data.contact_phone}
                    </a>
                  ) : null}
                </div>
              ) : null}
              {data.access_point ? (
                <p className="mt-2 font-mono text-xs text-primary" dir="ltr">
                  {formatCoords(data.access_point.latitude, data.access_point.longitude)}
                </p>
              ) : null}
              {(data.access_point?.latitude ?? data.site?.latitude) != null ? (
                <a
                  href={osmDirectionsUrl(
                    data.access_point?.latitude ?? data.site?.latitude,
                    data.access_point?.longitude ?? data.site?.longitude,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
                >
                  <Navigation className="size-4" /> الاتجاهات
                </a>
              ) : null}
              <p className="mt-3 text-[11px] text-muted-foreground">
                هذا الرابط يكشف فقط ما اختار صاحب العنوان مشاركته، وينتهي تلقائياً. العنوان يبقى خاصاً
                وغير قابل للبحث.
              </p>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
