/**
 * Reusable Syriasan address field.
 *
 * Drop-in component for e-commerce checkouts and delivery apps: the customer
 * types a Syriasan smart code (SY-DAM-K7X4) or a temporary share token
 * (SY-TMP-XXXXX) instead of a long Syrian address. The code is resolved through
 * the public checkout API and the customer must confirm before anything is
 * handed to the store.
 *
 * Private unit information is never revealed unless the owner shared it through
 * a temporary link.
 */
import { useCallback, useEffect, useId, useState } from "react";
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

export type WidgetLang = "ar" | "en";

export type SyriasanAddressFieldProps = {
  /** Origin that serves the Syriasan public API. Defaults to the current origin. */
  apiBase?: string;
  /** Called after the customer confirms the resolved address. */
  onConfirm?: (address: CheckoutAddressPayload) => void;
  /** Called whenever the customer clears or edits the confirmed address. */
  onClear?: () => void;
  /** Called on every successful resolution, before confirmation. */
  onResolve?: (address: CheckoutAddressPayload) => void;
  title?: string | undefined;
  compact?: boolean;
  lang?: WidgetLang;
  /** Prefilled code, e.g. restored from a saved order. */
  initialCode?: string;
  /** Resolve the prefilled code immediately. */
  autoResolve?: boolean;
};

const T = {
  ar: {
    title: "العنوان الذكي",
    hint: "بدلاً من كتابة العنوان بالكامل، أدخل الرمز الذكي أو رابط المشاركة المؤقت.",
    check: "تحقق",
    found: "تم العثور على العنوان",
    confirm: "تأكيد العنوان",
    confirmed: "تم تأكيد العنوان",
    change: "تغيير",
    short: "اكتب رمزاً مثل SY-DAM-K7X4",
    offline: "تعذر الاتصال بخدمة سيرياسان — حاول مجدداً.",
    privateAddr: "هذا عنوان خاص — اطلب من صاحبه رابط مشاركة مؤقت.",
    rows: {
      governorate: "المحافظة",
      city: "المدينة",
      district: "المنطقة",
      neighborhood: "الحي",
      street: "الشارع",
      building: "البناء",
      entrance: "المدخل",
      floor: "الطابق",
      unit: "الشقة",
      landmark: "معلم قريب",
      instructions: "تعليمات التسليم",
    },
    status: {
      not_found: "لم يُعثر على هذا الرمز — تأكد من كتابته بشكل صحيح.",
      expired: "انتهت صلاحية الرابط المؤقت — اطلب رابطاً جديداً من العميل.",
      revoked: "تم إلغاء هذا الرابط المؤقت.",
      invalid_request: "الرمز غير صالح.",
      fallback: "تعذر التحقق من الرمز.",
    } as Record<string, string>,
  },
  en: {
    title: "Syriasan Address",
    hint: "Instead of typing a full Syrian address, enter the smart code or a temporary share link.",
    check: "Check",
    found: "Address found",
    confirm: "Confirm Address",
    confirmed: "Address confirmed",
    change: "Change",
    short: "Enter a code such as SY-DAM-K7X4",
    offline: "Could not reach Syriasan — please try again.",
    privateAddr: "This address is private — ask the owner for a temporary share link.",
    rows: {
      governorate: "Governorate",
      city: "City",
      district: "District",
      neighborhood: "Neighborhood",
      street: "Street",
      building: "Building",
      entrance: "Entrance",
      floor: "Floor",
      unit: "Unit",
      landmark: "Landmark",
      instructions: "Delivery instructions",
    },
    status: {
      not_found: "This code was not found — please check the spelling.",
      expired: "This temporary link has expired — ask the customer for a new one.",
      revoked: "This temporary link was revoked.",
      invalid_request: "Invalid code.",
      fallback: "Could not verify this code.",
    } as Record<string, string>,
  },
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
  onResolve,
  title,
  compact = false,
  lang = "ar",
  initialCode = "",
  autoResolve = false,
}: SyriasanAddressFieldProps) {
  const t = T[lang] ?? T.ar;
  const [value, setValue] = useState(initialCode.toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<CheckoutAddressPayload | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const fieldId = useId();
  const hintId = `${fieldId}-hint`;
  const statusId = `${fieldId}-status`;

  const lookup = useCallback(
    async (raw?: string) => {
      const reference = (raw ?? value).trim().toUpperCase();
      if (reference.length < 4) {
        setError(t.short);
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
          onResolve?.(body as CheckoutAddressPayload);
        } else if (body.status === "private") {
          setError((body as { hint?: string }).hint ?? t.privateAddr);
        } else {
          setError(t.status[body.status] ?? t.status["fallback"] ?? "Could not verify this code.");
        }
      } catch {
        setError(t.offline);
      } finally {
        setBusy(false);
      }
    },
    [apiBase, onResolve, t, value],
  );

  useEffect(() => {
    if (autoResolve && initialCode.trim().length >= 4) void lookup(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dir = lang === "en" ? "ltr" : "rtl";
  const align = lang === "en" ? "text-left" : "text-right";

  return (
    <div dir={dir} className={`w-full rounded-2xl border border-border bg-surface p-4 shadow-sm ${align}`}>
      <label htmlFor={fieldId} className="flex items-center gap-2 text-sm font-bold">
        <MapPin className="size-4 text-primary" /> {title ?? t.title}
      </label>
      {!compact ? <p id={hintId} className="mt-1 text-xs text-muted-foreground">{t.hint}</p> : null}

      <div className="mt-3 flex gap-2">
        <input
          id={fieldId}
          dir="ltr"
          value={value}
          placeholder="SY-DAM-K7X4"
          aria-describedby={[!compact ? hintId : null, error || busy ? statusId : null].filter(Boolean).join(" ") || undefined}
          aria-invalid={Boolean(error)}
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
          {t.check}
        </button>
      </div>

      {error ? (
        <p id={statusId} role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {error}
        </p>
      ) : null}

      {busy ? <p id={statusId} role="status" aria-live="polite" className="sr-only">{t.check}</p> : null}

      {resolved ? (
        <div className="mt-3 rounded-xl border border-border bg-background p-3">
          <p role="status" aria-live="polite" className="flex items-center gap-1.5 text-xs font-bold text-success">
            <CheckCircle2 className="size-3.5" /> {t.found}
          </p>
          <p className="mt-1 text-sm font-bold">{resolved.summary}</p>
          <div className="mt-2">
            <Row label={t.rows.governorate} value={resolved.fields.governorate} />
            <Row label={t.rows.city} value={resolved.fields.city} />
            <Row label={t.rows.district} value={resolved.fields.district} />
            <Row label={t.rows.neighborhood} value={resolved.fields.neighborhood} />
            <Row label={t.rows.street} value={resolved.fields.street} />
            <Row label={t.rows.building} value={resolved.fields.building} />
            <Row label={t.rows.entrance} value={resolved.fields.entrance} />
            <Row label={t.rows.floor} value={resolved.fields.floor} />
            <Row label={t.rows.unit} value={resolved.fields.unit} />
            <Row label={t.rows.landmark} value={resolved.fields.landmark} />
            <Row label={t.rows.instructions} value={resolved.delivery.instructions} />
          </div>

          <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" /> {resolved.privacy_note}
          </p>

          {confirmed ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-success/10 p-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-success">
                <CheckCircle2 className="size-3.5" /> {t.confirmed} ({resolved.reference})
              </span>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-1 text-[11px] font-bold"
                onClick={() => {
                  setConfirmed(false);
                  setResolved(null);
                  setValue("");
                  onClear?.();
                }}
              >
                {t.change}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
              onClick={() => {
                setConfirmed(true);
                onConfirm?.(resolved);
              }}
            >
              {t.confirm}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
