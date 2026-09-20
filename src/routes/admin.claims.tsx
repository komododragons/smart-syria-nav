import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileText, ScrollText, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  claimAuditTrail,
  claimQueue,
  reviewBusinessClaim,
} from "@/lib/claims.functions";
import { verificationLabel } from "@/lib/smart-address";
import { useI18n, type Bilingual } from "@/lib/i18n";

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

const CLAIM_STATUS_LABELS: Record<string, Bilingual> = {
  pending: { ar: "معلّقة", en: "Pending" },
  approved: { ar: "موافَق عليها", en: "Approved" },
  rejected: { ar: "مرفوضة", en: "Rejected" },
};

const CLAIM_METHOD_LABELS: Record<string, Bilingual> = {
  document: { ar: "وثيقة رسمية", en: "Official document" },
  utility_bill: { ar: "فاتورة خدمة", en: "Utility bill" },
  phone_match: { ar: "تطابق رقم الهاتف", en: "Phone number match" },
  site_visit: { ar: "زيارة ميدانية", en: "Site visit" },
  other: { ar: "أخرى", en: "Other" },
};

const AUDIT_LABELS: Record<string, Bilingual> = {
  business_claim_submitted: { ar: "طلب مطالبة جديد", en: "New claim submitted" },
  business_claim_approved: { ar: "قبول مطالبة", en: "Claim approved" },
  business_claim_rejected: { ar: "رفض مطالبة", en: "Claim rejected" },
  business_claim_withdrawn: { ar: "سحب مطالبة", en: "Claim withdrawn" },
  business_ownership_transferred: { ar: "نقل ملكية عمل", en: "Business ownership transferred" },
};

function AdminClaimsPage() {
  const { t, lang, date } = useI18n();
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
        toast.error(t({ ar: "الطلب لم يعد معلّقاً", en: "The claim is no longer pending" }));
      } else {
        toast.success(
          decision === "approved"
            ? t({
                ar: `تمت الموافقة ونُقلت الملكية${res.superseded ? ` — أُغلقت ${res.superseded} مطالبة متعارضة` : ""}`,
                en: `Approved and ownership transferred${res.superseded ? ` — closed ${res.superseded} conflicting claim(s)` : ""}`,
              })
            : t({ ar: "تم رفض المطالبة", en: "Claim rejected" }),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-claims"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-claims-audit"] });
    } catch {
      toast.error(t({ ar: "تعذّر تنفيذ القرار — تحتاج صلاحية مشرف أو مراجع", en: "Could not save the decision — admin or reviewer role required" }));
    } finally {
      setBusyId(null);
    }
  };

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground" dir="rtl">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign-in required" })}</h1>
          <Link to="/auth" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
            {t({ ar: "تسجيل الدخول", en: "Sign in" })}
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
          <h1 className="text-xl font-bold">{t({ ar: "صلاحية غير كافية", en: "Insufficient permissions" })}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t({ ar: "هذه الصفحة مخصصة للمشرفين والمراجعين.", en: "This page is available to admins and reviewers only." })}</p>
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
            {t({ ar: "مطالبات ملكية الأعمال", en: "Business ownership claims" })}
          </h1>
          <Link to="/admin" className="text-sm text-primary underline">
            {t({ ar: "لوحة الإدارة", en: "Admin dashboard" })}
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
              {key === "all" ? t({ ar: "الكل", en: "All" }) : t(CLAIM_STATUS_LABELS[key])}
            </button>
          ))}
        </div>

        {queue.isLoading ? <p className="text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p> : null}
        {!queue.isLoading && claims.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {t({ ar: "لا توجد مطالبات في هذه القائمة.", en: "No claims in this list." })}
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
                    <h2 className="font-semibold">{biz?.name_ar ?? t({ ar: "عمل غير معروف", en: "Unknown business" })}</h2>
                    <p className="text-xs text-muted-foreground">
                      {date(claim.created_at)} ·{" "}
                      {CLAIM_STATUS_LABELS[claim.status] ? t(CLAIM_STATUS_LABELS[claim.status]) : claim.status}
                    </p>
                  </div>
                  {biz?.owner_id ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                      {t({ ar: "للعمل مالك موثق حالياً", en: "This business already has a verified owner" })}
                    </span>
                  ) : null}
                </header>

                {conflict ? (
                  <p className="mt-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    {t({
                      ar: `تعارض: ${claim.competing_pending} مطالبات معلّقة على نفس العمل — قبول واحدة يُغلق الباقي تلقائياً.`,
                      en: `Conflict: ${claim.competing_pending} pending claims on the same business — approving one closes the rest automatically.`,
                    })}
                  </p>
                ) : null}

                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <Row label={t({ ar: "المطالِب", en: "Claimant" })} value={claim.claimant_name ?? "—"} />
                  <Row label={t({ ar: "الصفة", en: "Role" })} value={claim.claimant_role ?? "—"} />
                  <Row label={t({ ar: "هاتف التواصل", en: "Contact phone" })} value={claim.contact_phone ?? "—"} />
                  <Row label={t({ ar: "البريد", en: "Email" })} value={claim.contact_email ?? "—"} />
                  <Row
                    label={t({ ar: "طريقة الإثبات", en: "Proof method" })}
                    value={CLAIM_METHOD_LABELS[claim.claim_method] ? t(CLAIM_METHOD_LABELS[claim.claim_method]) : claim.claim_method}
                  />
                  <Row label={t({ ar: "هاتف العمل المعلن", en: "Listed business phone" })} value={biz?.phone ?? "—"} />
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
                          {t({ ar: "فتح الوثيقة", en: "Open document" })}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {claim.status === "pending" ? (
                  <div className="mt-4 space-y-2">
                    <textarea
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      placeholder={t({ ar: "ملاحظات المراجعة (تُسجَّل في سجل التدقيق)", en: "Review notes (logged to the audit trail)" })}
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
                            {verificationLabel(lvl, lang)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => decide(claim.id, "approved")}
                        className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                      >
                        <ThumbsUp className="h-4 w-4" /> {t({ ar: "قبول ونقل الملكية", en: "Approve & transfer ownership" })}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === claim.id}
                        onClick={() => decide(claim.id, "rejected")}
                        className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50"
                      >
                        <ThumbsDown className="h-4 w-4" /> {t({ ar: "رفض", en: "Reject" })}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-muted-foreground">
                    {claim.reviewed_at ? t({ ar: `روجعت في ${date(claim.reviewed_at)}`, en: `Reviewed on ${date(claim.reviewed_at)}` }) : null}
                    {claim.granted_level
                      ? ` · ${t({ ar: "المستوى الممنوح", en: "Granted level" })}: ${verificationLabel(claim.granted_level, lang)}`
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
            {t({ ar: "سجل التدقيق — الملكية والمطالبات", en: "Audit trail — ownership & claims" })}
          </h2>
          <ul className="mt-3 space-y-2 text-xs">
            {(audit.data?.authorized ? audit.data.logs : []).map((log) => (
              <li key={log.id} className="rounded-lg bg-muted px-3 py-2">
                <span className="font-medium">{AUDIT_LABELS[log.action] ? t(AUDIT_LABELS[log.action]) : log.action}</span>
                <span className="mx-2 text-muted-foreground">
                  {date(log.created_at)}
                </span>
                <code className="text-[10px] text-muted-foreground">{log.resource_id}</code>
              </li>
            ))}
            {audit.data?.authorized && audit.data.logs.length === 0 ? (
              <li className="text-muted-foreground">{t({ ar: "لا توجد سجلات بعد.", en: "No log entries yet." })}</li>
            ) : null}
          </ul>
        </section>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
