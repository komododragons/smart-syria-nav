import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, BadgeCheck, Gauge, GitMerge, ScanSearch, ScrollText, ThumbsDown, ThumbsUp } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { adminOverview, reviewClaim, reviewCorrection } from "@/lib/addresses.functions";
import {
  detectDuplicates,
  listDuplicates,
  reviewDuplicate,
  verifierQueue,
} from "@/lib/network.functions";
import { CORRECTION_TYPES, NODE_TYPE_LABELS, PURPOSE_LABELS } from "@/lib/smart-address";

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
  const reviewClaimFn = useServerFn(reviewClaim);
  const detectFn = useServerFn(detectDuplicates);
  const listDupFn = useServerFn(listDuplicates);
  const reviewDupFn = useServerFn(reviewDuplicate);
  const queueFn = useServerFn(verifierQueue);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overview({ data: undefined as never }),
    enabled: authed === true,
  });

  const dupQuery = useQuery({
    queryKey: ["admin-duplicates"],
    queryFn: () => listDupFn({ data: undefined as never }),
    enabled: authed === true && query.data?.authorized === true,
  });

  const verifyQueueQuery = useQuery({
    queryKey: ["admin-verify-queue"],
    queryFn: () => queueFn({ data: undefined as never }),
    enabled: authed === true && query.data?.authorized === true,
  });

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await detectFn({ data: undefined as never });
      toast.success(`فُحص ${result.scanned} عقدة — ${result.inserted} تكرار جديد`);
      await queryClient.invalidateQueries({ queryKey: ["admin-duplicates"] });
    } catch {
      toast.error("تعذر فحص التكرارات");
    } finally {
      setScanning(false);
    }
  };

  const handleDupReview = async (id: string, action: "merge" | "dismiss", keep: "a" | "b") => {
    setBusyId(id);
    try {
      await reviewDupFn({ data: { id, action, keep } });
      toast.success(action === "merge" ? "تم الدمج ونقل البيانات" : "تم رفض التكرار");
      await queryClient.invalidateQueries({ queryKey: ["admin-duplicates"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      toast.error("تعذر تنفيذ الإجراء");
    } finally {
      setBusyId(null);
    }
  };

  const handleReview = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    try {
      await review({ data: { id, decision, apply: false } });
      toast.success(decision === "approved" ? "تم قبول التقرير" : "تم رفض التقرير");
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      toast.error("تعذّر تحديث التقرير — تحتاج صلاحية مشرف أو مراجع");
    } finally {
      setBusyId(null);
    }
  };

  const handleClaimReview = async (id: string, status: "approved" | "rejected") => {
    setBusyId(id);
    try {
      await reviewClaimFn({ data: { id, status } });
      toast.success(status === "approved" ? "تمت الموافقة ونُقلت الملكية" : "تم رفض المطالبة");
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      toast.error("تعذّر تحديث المطالبة — تحتاج صلاحية مشرف أو مراجع");
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
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold">لوحة إدارة الشبكة</h1>
          <Link
            to="/admin/navigation"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground"
          >
            <Activity className="size-3.5" /> لوحة التوجيه
          </Link>
          <Link
            to="/admin/quality"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground"
          >
            <Gauge className="size-3.5" /> جودة العناوين
          </Link>
          <Link
            to="/admin/audit"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground"
          >
            <ScrollText className="size-3.5" /> سجل التدقيق
          </Link>
        </div>

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
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  مواقع بانتظار التوثيق (
                  {(verifyQueueQuery.data?.authorized
                    ? verifyQueueQuery.data.nodes.length + verifyQueueQuery.data.access_points.length
                    : 0)}
                  )
                </h2>
                <Link
                  to="/verify"
                  className="flex items-center gap-1.5 rounded-lg bg-allow px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                >
                  <BadgeCheck className="size-3.5" /> فتح صفحة التوثيق
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {verifyQueueQuery.data?.authorized &&
                verifyQueueQuery.data.nodes.length === 0 &&
                verifyQueueQuery.data.access_points.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا عناصر بانتظار التوثيق.</p>
                ) : null}
                {verifyQueueQuery.data?.authorized
                  ? verifyQueueQuery.data.nodes.slice(0, 8).map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                      >
                        <p className="text-sm font-bold">{node.display_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {NODE_TYPE_LABELS[node.node_type] ?? node.node_type} ·{" "}
                          {[node.neighborhood, node.city].filter(Boolean).join(" — ")} · ثقة{" "}
                          {node.confidence_score}%
                        </p>
                      </div>
                    ))
                  : null}
                {verifyQueueQuery.data?.authorized
                  ? verifyQueueQuery.data.access_points.slice(0, 8).map((ap) => (
                      <div
                        key={ap.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                      >
                        <p className="text-sm font-bold">{ap.display_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {ap.location_nodes?.display_name ?? ""} · ثقة {ap.confidence_score}%
                        </p>
                      </div>
                    ))
                  : null}
              </div>
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
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleString("ar-SY")}
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => handleReview(item.id, "reviewed")}
                            className="rounded-md bg-allow px-2.5 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                          >
                            تمت المراجعة
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => handleReview(item.id, "dismissed")}
                            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground disabled:opacity-50"
                          >
                            رفض
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                التصحيحات لا تُطبّق تلقائياً على العناوين الموثقة — المراجعة بشرية.
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  مطالبات ملكية الأعمال المعلّقة
                </h2>
                <Link to="/admin/claims" className="text-xs font-bold text-primary underline">
                  فتح لوحة المراجعة الكاملة
                </Link>
              </div>
              {query.data.claims.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">لا مطالبات معلّقة.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {query.data.claims.map((claim) => {
                    const biz = Array.isArray(claim.businesses) ? claim.businesses[0] : claim.businesses;
                    return (
                      <div key={claim.id} className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold">{biz?.name_ar ?? "عمل"}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(claim.created_at).toLocaleString("ar-SY")}
                          </span>
                        </div>
                        {claim.evidence ? (
                          <p className="mt-1 text-xs text-muted-foreground">{claim.evidence}</p>
                        ) : null}
                        <div className="mt-2 flex justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === claim.id}
                            onClick={() => handleClaimReview(claim.id, "approved")}
                            className="rounded-md bg-allow px-2.5 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                          >
                            موافقة ونقل الملكية
                          </button>
                          <button
                            type="button"
                            disabled={busyId === claim.id}
                            onClick={() => handleClaimReview(claim.id, "rejected")}
                            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground disabled:opacity-50"
                          >
                            رفض
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                الموافقة تنقل ملكية العمل إلى المُطالِب وترفع توثيقه إلى «موثق من المالك».
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  تكرارات مرشحة للدمج
                </h2>
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => void handleScan()}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-bold text-background disabled:opacity-50"
                >
                  <ScanSearch className="size-3.5" /> {scanning ? "جارٍ الفحص…" : "فحص الآن"}
                </button>
              </div>
              {dupQuery.data && !dupQuery.data.authorized ? (
                <p className="mt-3 text-sm text-muted-foreground">مراجعة التكرارات للمشرفين فقط.</p>
              ) : dupQuery.data?.candidates.length ? (
                <div className="mt-3 space-y-2">
                  {dupQuery.data.candidates.map((cand) => {
                    const a = dupQuery.data?.authorized ? dupQuery.data.nodes[cand.node_a] : undefined;
                    const b = dupQuery.data?.authorized ? dupQuery.data.nodes[cand.node_b] : undefined;
                    return (
                      <div key={cand.id} className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">أ: {a?.display_name ?? cand.node_a}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {a ? `${NODE_TYPE_LABELS[a.node_type] ?? a.node_type} · ${[a.neighborhood, a.city].filter(Boolean).join(" — ")}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-[10px] text-primary" dir="ltr">
                            {cand.distance_meters != null ? `${Math.round(cand.distance_meters)}m` : ""}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">ب: {b?.display_name ?? cand.node_b}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {b ? `${NODE_TYPE_LABELS[b.node_type] ?? b.node_type} · ${[b.neighborhood, b.city].filter(Boolean).join(" — ")}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === cand.id}
                            onClick={() => void handleDupReview(cand.id, "merge", "a")}
                            className="flex items-center gap-1 rounded-md bg-allow px-2.5 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                          >
                            <GitMerge className="size-3" /> دمج بإبقاء أ
                          </button>
                          <button
                            type="button"
                            disabled={busyId === cand.id}
                            onClick={() => void handleDupReview(cand.id, "merge", "b")}
                            className="flex items-center gap-1 rounded-md bg-allow px-2.5 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                          >
                            <GitMerge className="size-3" /> دمج بإبقاء ب
                          </button>
                          <button
                            type="button"
                            disabled={busyId === cand.id}
                            onClick={() => void handleDupReview(cand.id, "dismiss", "a")}
                            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground disabled:opacity-50"
                          >
                            ليسا مكررين
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  لا تكرارات معلّقة. شغّل «فحص الآن» لمسح العقد العامة ضمن نطاق 30 متراً.
                </p>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                الدمج ينقل المداخل والأعمال والعناوين الذكية إلى العقدة المحتفَظ بها ويُنشئ تحويلات للرموز المتقاعدة.
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  تقييمات الوصول الأخيرة
                </h2>
                {query.data.successRate !== null ? (
                  <span className="rounded-md bg-allow-surface px-2 py-1 text-[11px] font-bold text-allow">
                    نسبة الوصول الناجح: {query.data.successRate}%
                  </span>
                ) : null}
              </div>
              {query.data.feedback.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">لا تقييمات بعد.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {query.data.feedback.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                    >
                      <div className="flex items-center gap-2">
                        {item.successful ? (
                          <ThumbsUp className="size-4 text-allow" />
                        ) : (
                          <ThumbsDown className="size-4 text-prohibit" />
                        )}
                        <div>
                          <span className="font-mono text-[11px]" dir="ltr">
                            {item.smart_code}
                          </span>
                          <span className="mx-2 text-[11px] text-muted-foreground">
                            {PURPOSE_LABELS[item.purpose] ?? item.purpose}
                          </span>
                          {item.notes ? (
                            <p className="text-xs text-muted-foreground">{item.notes}</p>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleString("ar-SY")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                كل تقييم يحرّك درجة الثقة للمدخل المعني (+3 نجاح / −5 فشل) ويُسجَّل في سجل أحداث الثقة.
              </p>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
