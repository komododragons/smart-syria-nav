import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CircleCheck, Flag, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { reportCorrection, submitVisitFeedback } from "@/lib/addresses.functions";
import { CORRECTION_TYPES, PURPOSE_LABELS } from "@/lib/smart-address";

type Props = {
  smartCode: string;
  purpose: string;
  nodeId: string | null;
  accessPointId: string | null;
  businessId?: string | null;
};

export function AddressFeedback({ smartCode, purpose, nodeId, accessPointId, businessId }: Props) {
  const navigate = useNavigate();
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
    toast.error("يلزم تسجيل الدخول أولاً", {
      action: { label: "الدخول", onClick: () => navigate({ to: "/auth" }) },
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
      toast.success("تم إرسال التصحيح للمراجعة — لن يُعدّل المعلومات الموثقة تلقائياً");
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
          هل وصلت إلى المدخل الصحيح؟
        </h2>
        <span className="text-[11px] text-muted-foreground">
          الغرض: {PURPOSE_LABELS[purpose] ?? purpose}
        </span>
      </div>

      {visitState === "done" ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-allow-surface p-3 text-sm font-bold text-allow">
          <CircleCheck className="size-4" />
          شكراً — تقييمك يحسّن درجة الثقة لهذا العنوان.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => pickVisit(true)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                successful === true
                  ? "bg-allow text-primary-foreground"
                  : "border border-border bg-background"
              }`}
            >
              <ThumbsUp className="size-4" />
              وصلت بنجاح
            </button>
            <button
              type="button"
              onClick={() => pickVisit(false)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                successful === false
                  ? "bg-prohibit text-primary-foreground"
                  : "border border-border bg-background"
              }`}
            >
              <ThumbsDown className="size-4" />
              لم أصل
            </button>
          </div>

          {visitState === "notes" ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                maxLength={400}
                placeholder="ملاحظة اختيارية: ما الذي حصل؟"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                disabled={sending}
                onClick={sendVisit}
                className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-bold text-background disabled:opacity-50"
              >
                {sending ? "جارٍ الإرسال…" : "إرسال التقييم"}
              </button>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {reportSent ? (
          <p className="flex items-center gap-2 text-sm font-bold text-allow">
            <CircleCheck className="size-4" />
            وصل تقريرك إلى فريق المراجعة.
          </p>
        ) : reportOpen ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">أبلغ عن مشكلة</span>
              <button
                type="button"
                aria-label="إغلاق"
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
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    issueType === type.value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-background text-muted-foreground"
                  }`}
                >
                  {type.ar}
                </button>
              ))}
            </div>
            {selectedType?.valueLabel ? (
              <label className="block text-xs font-bold text-muted-foreground">
                {selectedType.valueLabel}
                <input
                  value={suggested}
                  onChange={(event) => setSuggested(event.target.value)}
                  maxLength={300}
                  placeholder={selectedType.placeholder ?? ""}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none"
                />
              </label>
            ) : null}
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={2}
              maxLength={600}
              placeholder="تفاصيل إضافية (اختياري)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              disabled={!issueType || sending}
              onClick={sendReport}
              className="w-full rounded-lg bg-foreground px-3 py-2 text-sm font-bold text-background disabled:opacity-50"
            >
              {sending ? "جارٍ الإرسال…" : "إرسال التقرير للمراجعة"}
            </button>
            <p className="text-[11px] text-muted-foreground">
              التصحيحات تمر بمراجعة بشرية ولا تستبدل المعلومات الموثقة تلقائياً.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Flag className="size-3.5" />
            شيء خاطئ هنا؟ أبلغ عن تصحيح
          </button>
        )}
      </div>
    </section>
  );
}
