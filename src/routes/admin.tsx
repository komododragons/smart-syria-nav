import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Activity, BadgeCheck, BarChart3, CreditCard, Gauge, GitMerge, ScanSearch, ScrollText, ThumbsDown, ThumbsUp } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { adminOverview, reviewClaim, reviewCorrection } from "@/lib/addresses.functions";
import {
  detectDuplicates,
  listDuplicates,
  reviewDuplicate,
  verifierQueue,
} from "@/lib/network.functions";
import { correctionTypeLabel, nodeTypeLabel, purposeLabel } from "@/lib/smart-address";
import { useI18n } from "@/lib/i18n";

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

function AdminPage() {
  const { t, lang, date } = useI18n();
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

  const METRIC_LABELS: Record<string, string> = {
    nodes: t({ ar: "عقد مكانية", en: "Location nodes" }),
    accessPoints: t({ ar: "نقاط وصول", en: "Access points" }),
    codes: t({ ar: "عناوين ذكية", en: "Smart addresses" }),
    businesses: t({ ar: "أعمال منشورة", en: "Published businesses" }),
    temporary: t({ ar: "عناوين مؤقتة", en: "Temporary addresses" }),
    corrections: t({ ar: "تقارير تصحيح", en: "Correction reports" }),
    duplicates: t({ ar: "تكرارات مرشحة", en: "Duplicate candidates" }),
    visits: t({ ar: "تقييمات وصول", en: "Access feedback" }),
  };

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
      toast.success(
        t({
          ar: `فُحص ${result.scanned} عقدة — ${result.inserted} تكرار جديد`,
          en: `Scanned ${result.scanned} nodes — ${result.inserted} new duplicate(s)`,
        }),
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-duplicates"] });
    } catch {
      toast.error(t({ ar: "تعذر فحص التكرارات", en: "Could not scan for duplicates" }));
    } finally {
      setScanning(false);
    }
  };

  const handleDupReview = async (id: string, action: "merge" | "dismiss", keep: "a" | "b") => {
    setBusyId(id);
    try {
      await reviewDupFn({ data: { id, action, keep } });
      toast.success(
        action === "merge"
          ? t({ ar: "تم الدمج ونقل البيانات", en: "Merged and data migrated" })
          : t({ ar: "تم رفض التكرار", en: "Duplicate dismissed" }),
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-duplicates"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      toast.error(t({ ar: "تعذر تنفيذ الإجراء", en: "Could not complete the action" }));
    } finally {
      setBusyId(null);
    }
  };

  const handleReview = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    try {
      await review({ data: { id, decision, apply: false } });
      toast.success(
        decision === "approved"
          ? t({ ar: "تم قبول التقرير", en: "Report approved" })
          : t({ ar: "تم رفض التقرير", en: "Report rejected" }),
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      toast.error(
        t({
          ar: "تعذّر تحديث التقرير — تحتاج صلاحية مشرف أو مراجع",
          en: "Could not update the report — admin or reviewer role required",
        }),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleClaimReview = async (id: string, status: "approved" | "rejected") => {
    setBusyId(id);
    try {
      await reviewClaimFn({ data: { id, status } });
      toast.success(
        status === "approved"
          ? t({ ar: "تمت الموافقة ونُقلت الملكية", en: "Approved and ownership transferred" })
          : t({ ar: "تم رفض المطالبة", en: "Claim rejected" }),
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch {
      toast.error(
        t({
          ar: "تعذّر تحديث المطالبة — تحتاج صلاحية مشرف أو مراجع",
          en: "Could not update the claim — admin or reviewer role required",
        }),
      );
    } finally {
      setBusyId(null);
    }
  };

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign-in required" })}</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/admin" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
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
          <h1 className="text-lg font-bold">{t({ ar: "لوحة إدارة الشبكة", en: "Network admin dashboard" })}</h1>
          <Link
            to="/admin/navigation"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground"
          >
            <Activity className="size-3.5" /> {t({ ar: "لوحة التوجيه", en: "Navigation dashboard" })}
          </Link>
          <Link
            to="/admin/analytics"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground"
          >
            <BarChart3 className="size-3.5" /> {t({ ar: "تحليلات الشبكة", en: "Network analytics" })}
          </Link>
          <Link
            to="/admin/plans"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground"
          >
            <CreditCard className="size-3.5" /> {t({ ar: "إدارة الخطط", en: "Manage plans" })}
          </Link>
          <Link
            to="/admin/quality"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground"
          >
            <Gauge className="size-3.5" /> {t({ ar: "جودة العناوين", en: "Address quality" })}
          </Link>
          <Link
            to="/admin/audit"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground"
          >
            <ScrollText className="size-3.5" /> {t({ ar: "سجل التدقيق", en: "Audit log" })}
          </Link>
        </div>

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p>
        ) : null}

        {query.data && !query.data.authorized ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t({ ar: "هذه اللوحة مخصصة للمشرفين والمراجعين فقط.", en: "This dashboard is available to admins and reviewers only." })}
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
                  {t({ ar: "مواقع بانتظار التوثيق (", en: "Locations awaiting verification (" })}
                  {(verifyQueueQuery.data?.authorized
                    ? verifyQueueQuery.data.nodes.length + verifyQueueQuery.data.access_points.length
                    : 0)}
                  {")"}
                </h2>
                <Link
                  to="/verify"
                  className="flex items-center gap-1.5 rounded-lg bg-allow px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
                >
                  <BadgeCheck className="size-3.5" /> {t({ ar: "فتح صفحة التوثيق", en: "Open verification page" })}
                </Link>
              </div>
              <div className="mt-3 space-y-2">
                {verifyQueueQuery.data?.authorized &&
                verifyQueueQuery.data.nodes.length === 0 &&
                verifyQueueQuery.data.access_points.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t({ ar: "لا عناصر بانتظار التوثيق.", en: "No items awaiting verification." })}</p>
                ) : null}
                {verifyQueueQuery.data?.authorized
                  ? verifyQueueQuery.data.nodes.slice(0, 8).map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                      >
                        <p className="text-sm font-bold">{node.display_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {nodeTypeLabel(node.node_type, lang)} ·{" "}
                          {[node.neighborhood, node.city].filter(Boolean).join(" — ")} ·{" "}
                          {t({ ar: "ثقة", en: "confidence" })} {node.confidence_score}%
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
                          {ap.location_nodes?.display_name ?? ""} · {t({ ar: "ثقة", en: "confidence" })} {ap.confidence_score}%
                        </p>
                      </div>
                    ))
                  : null}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t({ ar: "تقارير تصحيح معلّقة", en: "Pending correction reports" })}
                </h2>
                <Link to="/admin/corrections" className="text-xs font-bold text-primary underline">
                  {t({ ar: "لوحة مراجعة التصحيحات", en: "Correction review dashboard" })}
                </Link>
              </div>
              {query.data.pending.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t({ ar: "لا تقارير معلّقة.", en: "No pending reports." })}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {query.data.pending.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">
                          {correctionTypeLabel(item.issue_type, lang)}
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
                          {date(item.created_at)}
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => handleReview(item.id, "approved")}
                            className="rounded-md bg-allow px-2.5 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                          >
                            {t({ ar: "قبول", en: "Approve" })}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => handleReview(item.id, "rejected")}
                            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground disabled:opacity-50"
                          >
                            {t({ ar: "رفض", en: "Reject" })}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t({
                  ar: "التصحيحات لا تُطبّق تلقائياً على العناوين الموثقة — المراجعة بشرية.",
                  en: "Corrections are never applied automatically to verified addresses — review is always human.",
                })}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t({ ar: "مطالبات ملكية الأعمال المعلّقة", en: "Pending business ownership claims" })}
                </h2>
                <Link to="/admin/claims" className="text-xs font-bold text-primary underline">
                  {t({ ar: "فتح لوحة المراجعة الكاملة", en: "Open full review dashboard" })}
                </Link>
              </div>
              {query.data.claims.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t({ ar: "لا مطالبات معلّقة.", en: "No pending claims." })}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {query.data.claims.map((claim) => {
                    const biz = Array.isArray(claim.businesses) ? claim.businesses[0] : claim.businesses;
                    return (
                      <div key={claim.id} className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold">{biz?.name_ar ?? t({ ar: "عمل", en: "Business" })}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {date(claim.created_at)}
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
                            {t({ ar: "موافقة ونقل الملكية", en: "Approve & transfer ownership" })}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === claim.id}
                            onClick={() => handleClaimReview(claim.id, "rejected")}
                            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground disabled:opacity-50"
                          >
                            {t({ ar: "رفض", en: "Reject" })}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t({
                  ar: "الموافقة تنقل ملكية العمل إلى المُطالِب وترفع توثيقه إلى «موثق من المالك».",
                  en: "Approving transfers business ownership to the claimant and raises verification to \"owner verified.\"",
                })}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t({ ar: "تكرارات مرشحة للدمج", en: "Duplicate candidates for merging" })}
                </h2>
                <button
                  type="button"
                  disabled={scanning}
                  onClick={() => void handleScan()}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-[11px] font-bold text-background disabled:opacity-50"
                >
                  <ScanSearch className="size-3.5" /> {scanning ? t({ ar: "جارٍ الفحص…", en: "Scanning…" }) : t({ ar: "فحص الآن", en: "Scan now" })}
                </button>
              </div>
              {dupQuery.data && !dupQuery.data.authorized ? (
                <p className="mt-3 text-sm text-muted-foreground">{t({ ar: "مراجعة التكرارات للمشرفين فقط.", en: "Duplicate review is admin-only." })}</p>
              ) : dupQuery.data?.candidates.length ? (
                <div className="mt-3 space-y-2">
                  {dupQuery.data.candidates.map((cand) => {
                    const a = dupQuery.data?.authorized ? dupQuery.data.nodes[cand.node_a] : undefined;
                    const b = dupQuery.data?.authorized ? dupQuery.data.nodes[cand.node_b] : undefined;
                    return (
                      <div key={cand.id} className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">{t({ ar: "أ", en: "A" })}: {a?.display_name ?? cand.node_a}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {a ? `${nodeTypeLabel(a.node_type, lang)} · ${[a.neighborhood, a.city].filter(Boolean).join(" — ")}` : ""}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono text-[10px] text-primary" dir="ltr">
                            {cand.distance_meters != null ? `${Math.round(cand.distance_meters)}m` : ""}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold">{t({ ar: "ب", en: "B" })}: {b?.display_name ?? cand.node_b}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {b ? `${nodeTypeLabel(b.node_type, lang)} · ${[b.neighborhood, b.city].filter(Boolean).join(" — ")}` : ""}
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
                            <GitMerge className="size-3" /> {t({ ar: "دمج بإبقاء أ", en: "Merge, keep A" })}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === cand.id}
                            onClick={() => void handleDupReview(cand.id, "merge", "b")}
                            className="flex items-center gap-1 rounded-md bg-allow px-2.5 py-1 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                          >
                            <GitMerge className="size-3" /> {t({ ar: "دمج بإبقاء ب", en: "Merge, keep B" })}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === cand.id}
                            onClick={() => void handleDupReview(cand.id, "dismiss", "a")}
                            className="rounded-md border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground disabled:opacity-50"
                          >
                            {t({ ar: "ليسا مكررين", en: "Not duplicates" })}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t({
                    ar: "لا تكرارات معلّقة. شغّل «فحص الآن» لمسح العقد العامة ضمن نطاق 30 متراً.",
                    en: "No pending duplicates. Run \"Scan now\" to check public nodes within a 30-metre radius.",
                  })}
                </p>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t({
                  ar: "الدمج ينقل المداخل والأعمال والعناوين الذكية إلى العقدة المحتفَظ بها ويُنشئ تحويلات للرموز المتقاعدة.",
                  en: "Merging moves entrances, businesses, and smart addresses to the kept node and creates redirects for retired codes.",
                })}
              </p>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t({ ar: "تقييمات الوصول الأخيرة", en: "Recent access feedback" })}
                </h2>
                {query.data.successRate !== null ? (
                  <span className="rounded-md bg-allow-surface px-2 py-1 text-[11px] font-bold text-allow">
                    {t({ ar: "نسبة الوصول الناجح", en: "Successful arrival rate" })}: {query.data.successRate}%
                  </span>
                ) : null}
              </div>
              {query.data.feedback.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t({ ar: "لا تقييمات بعد.", en: "No feedback yet." })}</p>
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
                            {purposeLabel(item.purpose, lang)}
                          </span>
                          {item.notes ? (
                            <p className="text-xs text-muted-foreground">{item.notes}</p>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {date(item.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                {t({
                  ar: "كل تقييم يحرّك درجة الثقة للمدخل المعني (+3 نجاح / −5 فشل) ويُسجَّل في سجل أحداث الثقة.",
                  en: "Every rating moves the confidence score for that entrance (+3 success / −5 failure) and is logged in the trust event history.",
                })}
              </p>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
