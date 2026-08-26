import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { adminOverview, reviewCorrection } from "@/lib/addresses.functions";
import { CORRECTION_TYPES, PURPOSE_LABELS } from "@/lib/smart-address";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة إدارة الشبكة" },
      {
        name: "description",
        content: "مؤشرات تغطية الشبكة، تقارير التصحيح المعلّقة، والعناوين المكررة المرشحة للدمج.",
      },
      { property: "og:title", content: "لوحة الإدارة — شبكة العنوان الذكي" },
      { property: "og:description", content: "مراجعة التصحيحات والتوثيق ومؤشرات التغطية." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const METRIC_LABELS: Record<string, string> = {
  nodes: "عقد مكانية",
  accessPoints: "نقاط وصول",
  codes: "عناوين ذكية",
  businesses: "أعمال منشورة",
  temporary: "عناوين مؤقتة",
  corrections: "تقارير تصحيح",
  duplicates: "تكرارات مرشحة",
  visits: "تقييمات وصول",
};

function AdminPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const overview = useServerFn(adminOverview);
  const review = useServerFn(reviewCorrection);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overview({ data: undefined as never }),
    enabled: authed === true,
  });

  const handleReview = async (id: string, status: "reviewed" | "dismissed") => {
    setBusyId(id);
    try {
      await review({ data: { id, status } });
      toast.success(status === "reviewed" ? "تمت مراجعة التقرير" : "تم رفض التقرير");
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      toast.error("تعذّر تحديث التقرير — تحتاج صلاحية مشرف أو مراجع");
    } finally {
      setBusyId(null);
    }
  };

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">يلزم تسجيل الدخول</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin" } })}
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
        <h1 className="text-lg font-bold">لوحة إدارة الشبكة</h1>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : null}

        {query.data && !query.data.authorized ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            هذه اللوحة مخصصة للمشرفين والمراجعين فقط.
          </p>
        ) : null}

        {query.data?.authorized ? (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(query.data.metrics).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-border bg-surface p-3">
                  <p className="font-mono text-2xl font-bold">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{METRIC_LABELS[key] ?? key}</p>
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                تقارير تصحيح معلّقة
              </h2>
              {query.data.pending.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">لا تقارير معلّقة.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {query.data.pending.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          {CORRECTION_TYPES.find((t) => t.value === item.issue_type)?.ar ??
                            item.issue_type}
                        </span>
                        {item.smart_code ? (
                          <span className="font-mono text-[11px]" dir="ltr">
                            {item.smart_code}
                          </span>
                        ) : null}
                      </div>
                      {item.details ? (
                        <p className="mt-1 text-xs text-muted-foreground">{item.details}</p>
                      ) : null}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("ar-SY")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                التصحيحات لا تُطبّق تلقائياً على العناوين الموثقة — المراجعة بشرية.
              </p>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
