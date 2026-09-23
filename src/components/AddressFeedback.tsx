import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CircleCheck, Flag, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { reportCorrection, submitVisitFeedback } from "@/lib/addresses.functions";
import { CORRECTION_TYPES, CORRECTION_FIELD_EN, correctionTypeLabel, purposeLabel } from "@/lib/smart-address";
import { useI18n } from "@/lib/i18n";

type Props = {
  smartCode: string;
  purpose: string;
  nodeId: string | null;
  accessPointId: string | null;
  businessId?: string | null;
};

export function AddressFeedback({ smartCode, purpose, nodeId, accessPointId, businessId }: Props) {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const report = useServerFn(reportCorrection);
  const feedback = useServerFn(submitVisitFeedback);

  const [visitState, setVisitState] = useState<"idle" | "notes" | "done">("idle");
  const [successful, setSuccessful] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [issueType, setIssueType] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [suggested, setSuggested] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const handleAuthError = () => {
    toast.error(t({ ar: "يلزم تسجيل الدخول أولاً", en: "Please sign in first" }), {
      action: {
        label: t({ ar: "الدخول", en: "Sign in" }),
        onClick: () => navigate({ to: "/auth" }),
      },
    });
  };

  const pickVisit = (ok: boolean) => {
    setSuccessful(ok);
    setVisitState("notes");
  };

  const sendVisit = async () => {
    if (successful === null) return;
    setSending(true);
    try {
      await feedback({
        data: {
          smart_code: smartCode,
          purpose,
          access_point_id: accessPointId,
          successful,
          notes: notes.trim() || undefined,
        },
      });
      setVisitState("done");
    } catch {
      handleAuthError();
      setVisitState("idle");
    } finally {
      setSending(false);
    }
  };

  const selectedType = CORRECTION_TYPES.find((t) => t.value === issueType);

  const sendReport = async () => {
    if (!issueType) return;
    setSending(true);
    try {
      await report({
        data: {
          smart_code: smartCode,
          issue_type: issueType,
          details: details.trim() || undefined,
          node_id: nodeId,
          access_point_id: accessPointId,
          business_id: businessId ?? null,
          target_field: selectedType?.field,
          suggested_value: suggested.trim() || undefined,
        },
      });
      setReportSent(true);
      toast.success(
        t({
          ar: "تم إرسال التصحيح للمراجعة — لن يُعدّل المعلومات الموثقة تلقائياً",
          en: "Correction sent for review — it will never overwrite verified information automatically",
        }),
      );
    } catch {
      handleAuthError();
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="animate-entrance rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {t({ ar: "هل وصلت إلى المدخل الصحيح؟", en: "Did you reach the right entrance?" })}
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {t({ ar: "الغرض", en: "Purpose" })}: {purposeLabel(purpose, lang)}
        </span>
      </div>

      {visitState === "done" ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-allow-surface p-3 text-sm font-bold text-allow">
          <CircleCheck className="size-4" />
          {t({
            ar: "شكراً — تقييمك يحسّن درجة الثقة لهذا العنوان.",
            en: "Thank you — your feedback improves the confidence score of this address.",
          })}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => pickVisit(true)}
              aria-pressed={successful === true}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                successful === true
                  ? "bg-allow text-primary-foreground"
                  : "border border-border bg-background"
              }`}
            >
              <ThumbsUp className="size-4" />
              {t({ ar: "وصلت بنجاح", en: "Arrived fine" })}
            </button>
            <button
              type="button"
              onClick={() => pickVisit(false)}
              aria-pressed={successful === false}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                successful === false
                  ? "bg-prohibit text-primary-foreground"
                  : "border border-border bg-background"
              }`}
            >
              <ThumbsDown className="size-4" />
              {t({ ar: "لم أصل", en: "Could not find it" })}
            </button>
          </div>

          {visitState === "notes" ? (
            <div className="space-y-2">
              <textarea
                aria-label={t({ ar: "ملاحظة الوصول الاختيارية", en: "Optional arrival note" })}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={400}
                placeholder={t({ ar: "ملاحظة اختيارية: ما الذي حصل؟", en: "Optional note: what happened?" })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                disabled={sending}
                onClick={sendVisit}
                className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-bold text-background disabled:opacity-50"
              >
                {sending
                  ? t({ ar: "جارٍ الإرسال…", en: "Sending…" })
                  : t({ ar: "إرسال التقييم", en: "Send feedback" })}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {reportSent ? (
          <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-bold text-allow">
            <CircleCheck className="size-4" />
            {t({ ar: "وصل تقريرك إلى فريق المراجعة.", en: "Your report reached the review team." })}
          </p>
        ) : reportOpen ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{t({ ar: "أبلغ عن مشكلة", en: "Report a problem" })}</span>
              <button
                type="button"
                aria-label={t({ ar: "إغلاق", en: "Close" })}
                onClick={() => setReportOpen(false)}
                className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CORRECTION_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setIssueType(type.value)}
                  aria-pressed={issueType === type.value}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    issueType === type.value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground"
                  }`}
                >
                  {correctionTypeLabel(type.value, lang)}
                </button>
              ))}
            </div>
            {selectedType?.valueLabel ? (
              <label className="block text-xs font-bold text-muted-foreground">
                {lang === "ar"
                  ? selectedType.valueLabel
                  : (CORRECTION_FIELD_EN[selectedType.value]?.valueLabel ?? selectedType.valueLabel)}
                <input
                  value={suggested}
                  onChange={(event) => setSuggested(event.target.value)}
                  maxLength={300}
                  placeholder={
                    (lang === "ar"
                      ? selectedType.placeholder
                      : CORRECTION_FIELD_EN[selectedType.value]?.placeholder) ?? ""
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none"
                />
              </label>
            ) : null}
            <textarea
              aria-label={t({ ar: "تفاصيل إضافية عن المشكلة", en: "Additional problem details" })}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={2}
              maxLength={600}
              placeholder={t({ ar: "تفاصيل إضافية (اختياري)", en: "Additional details (optional)" })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              disabled={!issueType || sending}
              onClick={sendReport}
              className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-bold text-background disabled:opacity-50"
            >
              {sending
                ? t({ ar: "جارٍ الإرسال…", en: "Sending…" })
                : t({ ar: "إرسال التقرير للمراجعة", en: "Send report for review" })}
            </button>
            <p className="text-[11px] text-muted-foreground">
              {t({
                ar: "التصحيحات تمر بمراجعة بشرية ولا تستبدل المعلومات الموثقة تلقائياً.",
                en: "Corrections go through human review and never replace verified information automatically.",
              })}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Flag className="size-3.5" />
            {t({ ar: "شيء خاطئ هنا؟ أبلغ عن تصحيح", en: "Something wrong here? Suggest a correction" })}
          </button>
        )}
      </div>
    </section>
  );
}
