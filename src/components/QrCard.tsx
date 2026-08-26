import { Printer, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

/**
 * Printable QR card for a smart code. The overlay doubles as the print sheet:
 * print CSS in styles.css hides the rest of the app and keeps this card.
 */
export function QrCard({
  url,
  code,
  title,
  subtitle,
  onClose,
}: {
  url: string;
  code: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
}) {
  return (
    <div
      className="qr-print-sheet fixed inset-0 z-[60] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`رمز QR للعنوان ${code}`}
    >
      <div
        className="w-full max-w-xs rounded-2xl border border-border bg-surface p-6 text-center shadow-plate"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          شبكة العنوان الذكي السورية
        </p>
        <h2 className="mt-1 text-base font-bold leading-tight">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}

        <div className="mx-auto mt-4 grid w-fit place-items-center rounded-xl border border-border bg-surface p-3">
          <QRCodeSVG value={url} size={180} bgColor="transparent" fgColor="currentColor" className="text-foreground" />
        </div>

        <p className="mt-3 font-mono text-lg font-bold" dir="ltr">
          {code}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          امسح الرمز لفتح تفاصيل الوصول — لا يحتوي أي بيانات شخصية.
        </p>

        <div className="no-print mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground"
          >
            <Printer className="size-4" />
            طباعة
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-bold"
          >
            <X className="size-4" />
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
