import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, ScrollText, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  CLAIM_METHODS,
  CLAIM_STATUS_LABELS,
  claimAuditTrail,
  claimQueue,
  reviewBusinessClaim,
} from "@/lib/claims.functions";
import { VERIFICATION_LEVELS } from "@/lib/smart-address";

export const Route = createFileRoute("/admin/claims")({
  head: () => ({
    meta: [
      { title: "مراجعة مطالبات الملكية | لوحة التوثيق" },
      {
        name: "description",
        content: "قائمة مطالبات ملكية الأعمال، كشف التعارضات، قرارات المراجعة، وسجل التدقيق.",
      },
      { property: "og:title", content: "مراجعة مطالبات الملكية — سيرياسان" },
      { property: "og:description", content: "مراجعة بشرية لطلبات توثيق ملكية الأعمال." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminClaimsPage,
});

const GRANT_LEVELS = [
  "user_confirmed",
  "community_confirmed",
  "business_verified",
  "organization_verified",
  "official_verified",
] as const;

function AdminClaimsPage() {
  const queryClient = useQueryClient();
  const queueFn = useServerFn(claimQueue);
  const reviewFn = useServerFn(reviewBusinessClaim);
  const auditFn = useServerFn(claimAuditTrail);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [levels, setLevels] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const queue = useQuery({
    queryKey: ["admin-claims", filter],
    queryFn: () => queueFn({ data: { status: filter } }),
    enabled: authed === true,
  });

  const audit = useQuery({
    queryKey: ["admin-claims-audit"],
    queryFn: () => auditFn({ data: {} }),
    enabled: authed === true,
  });

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    try {
      const res = await reviewFn({
        data: {
          id,
          decision,
          notes: notes[id]?.trim() || undefined,
          granted_level: (levels[id] as (typeof GRANT_LEVELS)[number]) ?? undefined,
        },
      });
      if (!res.ok) {
        toast.error("الطلب لم يعد معلّقاً");
      } else {
        toast.success(
          decision === "approved"
            ? `تمت الموافقة ونُقلت الملكية${res.superseded ? ` — أُغلقت ${res.superseded} مطالبة متعارضة` : ""}`
            : "تم رفض المطالبة",
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-claims"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-claims-audit"] });
    } catch {
      toast.error("تعذّر تنفيذ القرار — تحتاج صلاحية مشرف أو مراجع");
    } finally {
      setBusyId(null);
    }
  };

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground" dir="rtl">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">يلزم تسجيل الدخول</h1>
          <Link to="/auth" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
            تسجيل الدخول
          </Link>
        </main>
      </div>
    );
  }

  if (queue.data && queue.data.authorized === false) {
    return (
      <div className="min-h-screen bg-background text-foreground" dir="rtl">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">صلاحية غير كافية</h1>
          <p className="mt-2 text-sm text-muted-foreground">هذه الصفحة مخصصة للمشرفين والمراجعين.</p>
        </main>
      </div>
    );
  }

  const claims = queue.data?.authorized ? queue.data.claims : [];

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6 text-primary" />
            مطالبات ملكية الأعمال
          </h1>
          <Link to="/admin" className="text-sm text-primary underline">
            لوحة الإدارة
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === key ? "border-primary bg-primary text-primary-foreground" : "border-border"
              }`}
            >
              {key === "all" ? "الكل" : CLAIM_STATUS_LABELS[key]}
            </button>
          ))}
        </div>

        {queue.isLoading ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> : null}
        {!queue.isLoading && claims.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            لا توجد مطالبات في هذه القائمة.
          </p>
        ) : null}

        <div className="space-y-4">
          {claims.map((claim) => {
            const biz = Array.isArray(claim.businesses) ? claim.businesses[0] : claim.businesses;
            const conflict = claim.status === "pending" && claim.competing_pending > 1;
            return (
              <article key={claim.id} className="rounded-xl border border-border bg-card p-4">
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{biz?.name_ar ?? "عمل غير معروف"}</h2>
                    <p className="text-xs text-muted-foreground">
                      {new Date(claim.created_at).toLocaleString("ar-SY")} ·{" "}
                      {CLAIM_STATUS_LABELS[claim.status] ?? claim.status}
                    </p>
                  </div>
                  {biz?.owner_id ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                      للعمل مالك موثق حالياً
                    </span>
                  ) : null}
                </header>

                {conflict ? (
                  <p className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    تعارض: {claim.competing_pending} مطالبات معلّقة على نفس العمل — قبول واحدة يُغلق الباقي تلقائياً.
                  </p>
                ) : null}

                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <Row label="المطالِب" value={claim.claimant_name ?? "—"} />
                  <Row label="الصفة" value={claim.claimant_role ?? "—"} />
                  <Row label="هاتف التواصل" value={claim.contact_phone ?? "—"} />
                  <Row label="البريد" value={claim.contact_email ?? "—"} />
                  <Row
                    label="طريقة الإثبات"
                    value={CLAIM_METHODS[claim.claim_method as keyof typeof CLAIM_METHODS] ?? claim.claim_method}
                  />
                  <Row label="هاتف العمل المعلن" value={biz?.phone ?? "—"} />
                </dl>

                {claim.evidence ? (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">{claim.evidence}</p>
                ) : null}

                {claim.files.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {claim.files.map((file) => (
                      <li key={file.path}>
                        <a
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-primary"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          فتح الوثيقة
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {claim.status === "pending" ? (
                  <div className="mt-4 space-y-2">
                    <textarea
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      placeholder="ملاحظات المراجعة (تُسجَّل في سجل التدقيق)"
                      value={notes[claim.id] ?? ""}
                      onChange={(e) => setNotes((p) => ({ ...p, [claim.id]: e.target.value }))}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                        value={levels[claim.id] ?? "business_verified"}
                        onChange={(e) => setLevels((p) => ({ ...p, [claim.id]: e.target.value }))}
                      >
                        {GRANT_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {VERIFICATION_LEVELS[lvl]?.ar ?? lvl}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => decide(claim.id, "approved")}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                      >
                        <ThumbsUp className="h-4 w-4" /> قبول ونقل الملكية
                      </button>
                      <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => decide(claim.id, "rejected")}
                        className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
                      >
                        <ThumbsDown className="h-4 w-4" /> رفض
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {claim.reviewed_at ? `روجعت في ${new Date(claim.reviewed_at).toLocaleString("ar-SY")}` : null}
                    {claim.granted_level
                      ? ` · المستوى الممنوح: ${VERIFICATION_LEVELS[claim.granted_level]?.ar ?? claim.granted_level}`
                      : null}
                    {claim.review_notes ? ` · ${claim.review_notes}` : null}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <ScrollText className="h-5 w-5 text-primary" />
            سجل التدقيق — الملكية والمطالبات
          </h2>
          <ul className="mt-3 space-y-2 text-xs">
            {(audit.data?.authorized ? audit.data.logs : []).map((log) => (
              <li key={log.id} className="rounded-lg bg-muted px-3 py-2">
                <span className="font-medium">{AUDIT_LABELS[log.action] ?? log.action}</span>
                <span className="mx-2 text-muted-foreground">
                  {new Date(log.created_at).toLocaleString("ar-SY")}
                </span>
                <code className="text-[10px] text-muted-foreground">{log.resource_id}</code>
              </li>
            ))}
            {audit.data?.authorized && audit.data.logs.length === 0 ? (
              <li className="text-muted-foreground">لا توجد سجلات بعد.</li>
            ) : null}
          </ul>
        </section>
      </main>
    </div>
  );
}

const AUDIT_LABELS: Record<string, string> = {
  business_claim_submitted: "طلب مطالبة جديد",
  business_claim_approved: "قبول مطالبة",
  business_claim_rejected: "رفض مطالبة",
  business_claim_withdrawn: "سحب مطالبة",
  business_ownership_transferred: "نقل ملكية عمل",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
