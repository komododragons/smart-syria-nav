/**
 * Reusable Syriasan checkout address field.
 *
 * Drop-in component for e-commerce checkouts: the customer types a Syriasan
 * smart code (SY-DAM-K7X4) or a temporary share token (SY-TMP-XXXXX) instead of
 * a long Syrian address. The code is resolved through the public checkout API
 * and the customer must confirm before anything is handed to the store.
 *
 * Private unit information is never revealed unless the owner shared it through
 * a temporary link.
 */
import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MapPin, Search, ShieldCheck } from "lucide-react";

export type CheckoutAddressPayload = {
  status: "ok";
  source: "code" | "token";
  reference: string;
  summary: string;
  fields: {
    governorate: string | null;
    city: string | null;
    district: string | null;
    neighborhood: string | null;
    street: string | null;
    building: string | null;
    entrance: string | null;
    floor: string | null;
    unit: string | null;
    landmark: string | null;
  };
  coordinates: { latitude: number; longitude: number } | null;
  delivery: { instructions: string | null; parking: string | null; open_now: boolean | null };
  contact: { name: string | null; phone: string | null };
  verification_level: string | null;
  confidence: number | null;
  expires_at: string | null;
  navigation_url: string;
  privacy_note: string;
};

type Resolved = CheckoutAddressPayload | { status: string; hint?: string; reference?: string };

export type SyriasanAddressFieldProps = {
  /** Origin that serves the Syriasan public API. Defaults to the current origin. */
  apiBase?: string;
  /** Called after the customer confirms the resolved address. */
  onConfirm?: (address: CheckoutAddressPayload) => void;
  /** Called whenever the customer clears or edits the confirmed address. */
  onClear?: () => void;
  title?: string;
  compact?: boolean;
};

const STATUS_TEXT: Record<string, string> = {
  not_found: "لم يُعثر على هذا الرمز — تأكد من كتابته بشكل صحيح.",
  expired: "انتهت صلاحية الرابط المؤقت — اطلب رابطاً جديداً من العميل.",
  revoked: "تم إلغاء هذا الرابط المؤقت.",
  invalid_request: "الرمز غير صالح.",
};

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 text-xs last:border-0">
      <span className="font-bold text-muted-foreground">{label}</span>
      <span className="text-left">{value}</span>
    </div>
  );
}

export function SyriasanAddressField({
  apiBase,
  onConfirm,
  onClear,
  title = "أدخل عنوانك الذكي",
  compact = false,
}: SyriasanAddressFieldProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<CheckoutAddressPayload | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const lookup = useCallback(async () => {
    const reference = value.trim().toUpperCase();
    if (reference.length < 4) {
      setError("اكتب رمزاً مثل SY-DAM-K7X4");
      return;
    }
    setBusy(true);
    setError(null);
    setResolved(null);
    setConfirmed(false);
    try {
      const base = apiBase ?? (typeof window === "undefined" ? "https://syriasan.com" : window.location.origin);
      const res = await fetch(`${base}/api/public/checkout?reference=${encodeURIComponent(reference)}`);
      const body = (await res.json()) as Resolved;
      if (body.status === "ok") {
        setResolved(body as CheckoutAddressPayload);
      } else if (body.status === "private") {
        setError(
          (body as { hint?: string }).hint ??
            "هذا عنوان خاص — اطلب من صاحبه رابط مشاركة مؤقت.",
        );
      } else {
        setError(STATUS_TEXT[body.status] ?? "تعذر التحقق من الرمز.");
      }
    } catch {
      setError("تعذر الاتصال بخدمة سيرياسان — حاول مجدداً.");
    } finally {
      setBusy(false);
    }
  }, [apiBase, value]);

  return (
    <div dir="rtl" className="w-full rounded-2xl border border-border bg-surface p-4 text-right shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-bold">
        <MapPin className="size-4 text-primary" /> {title}
      </h3>
      {!compact ? (
        <p className="mt-1 text-xs text-muted-foreground">
          بدلاً من كتابة العنوان بالكامل، أدخل الرمز الذكي أو رابط المشاركة المؤقت.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <input
          dir="ltr"
          value={value}
          placeholder="SY-DAM-K7X4"
          onChange={(e) => {
            setValue(e.target.value.toUpperCase());
            if (confirmed) {
              setConfirmed(false);
              setResolved(null);
              onClear?.();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void lookup();
            }
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm tracking-wider outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void lookup()}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
          تحقق
        </button>
      </div>

      {error ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      ) : null}

      {resolved ? (
        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <p className="text-sm font-bold">{resolved.summary}</p>
          <div className="mt-2">
            <Row label="المحافظة" value={resolved.fields.governorate} />
            <Row label="المدينة" value={resolved.fields.city} />
            <Row label="المنطقة" value={resolved.fields.district} />
            <Row label="الحي" value={resolved.fields.neighborhood} />
            <Row label="الشارع" value={resolved.fields.street} />
            <Row label="البناء" value={resolved.fields.building} />
            <Row label="المدخل" value={resolved.fields.entrance} />
            <Row label="الطابق" value={resolved.fields.floor} />
            <Row label="الشقة" value={resolved.fields.unit} />
            <Row label="معلم قريب" value={resolved.fields.landmark} />
            <Row label="تعليمات التسليم" value={resolved.delivery.instructions} />
          </div>

          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" /> {resolved.privacy_note}
          </p>

          {confirmed ? (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-success/10 p-2 text-xs font-bold text-success">
              <CheckCircle2 className="size-3.5" /> تم تأكيد العنوان ({resolved.reference})
            </p>
          ) : (
            <button
              type="button"
              className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              onClick={() => {
                setConfirmed(true);
                onConfirm?.(resolved);
              }}
            >
              تأكيد هذا العنوان
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
