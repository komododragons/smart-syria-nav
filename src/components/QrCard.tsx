import { Download, LayoutTemplate, Printer, QrCode, Share2, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { QRCodeSVG } from "qrcode.react";
import { useId, useState } from "react";

import { useI18n } from "@/lib/i18n";

type PlateFormat = "a6" | "a5" | "a4" | "sticker" | "door" | "window";

const PLATE_FORMATS: { value: PlateFormat; label: string; labelEn: string; dimensions: string }[] = [
  { value: "a6", label: "A6", labelEn: "A6", dimensions: "105 × 148 mm" },
  { value: "a5", label: "A5", labelEn: "A5", dimensions: "148 × 210 mm" },
  { value: "a4", label: "A4", labelEn: "A4", dimensions: "210 × 297 mm" },
  { value: "sticker", label: "ملصق", labelEn: "Sticker", dimensions: "90 × 90 mm" },
  { value: "door", label: "لوحة باب", labelEn: "Door plate", dimensions: "200 × 100 mm" },
  { value: "window", label: "واجهة محل", labelEn: "Shop window", dimensions: "300 × 200 mm" },
];

/**
 * Printable QR card for a smart code. The overlay doubles as the print sheet:
 * print CSS in styles.css hides the rest of the app and keeps this card.
 */
export function QrCard({
  url,
  code,
  title,
  subtitle,
  logoUrl,
  initialPlate,
  onClose,
}: {
  url: string;
  code: string;
  title: string;
  subtitle?: string | undefined;
  logoUrl?: string | null | undefined;
  initialPlate?: boolean | undefined;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const qrId = useId().replace(/:/g, "");
  const [plateMode, setPlateMode] = useState(Boolean(initialPlate));
  const [format, setFormat] = useState<PlateFormat>("a6");

  const qrSvg = () => document.getElementById(qrId)?.querySelector("svg");
  const qrSvgBlob = () => {
    const svg = qrSvg();
    if (!svg) return null;
    const copy = svg.cloneNode(true) as SVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", "1024");
    copy.setAttribute("height", "1024");
    return new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml;charset=utf-8" });
  };

  const qrPngBlob = async () => {
    const blob = qrSvgBlob();
    if (!blob) return null;
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1200;
    const context = canvas.getContext("2d");
    if (!context) {
      URL.revokeObjectURL(objectUrl);
      return null;
    }
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 60, 60, 1080, 1080);
    URL.revokeObjectURL(objectUrl);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  const downloadQr = async () => {
    const blob = await qrPngBlob();
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `syriasan-${code}.png`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const shareQr = async () => {
    const blob = await qrPngBlob();
    const file = blob ? new File([blob], `syriasan-${code}.png`, { type: "image/png" }) : null;
    if (navigator.share) {
      try {
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: `${code} — ${title}`, text: t({ ar: "امسح للوصول إلى العنوان", en: "Scan to reach this address" }), url, files: [file] });
        } else {
          await navigator.share({ title: `${code} — ${title}`, text: t({ ar: "امسح للوصول إلى العنوان", en: "Scan to reach this address" }), url });
        }
        return;
      } catch {
        return;
      }
    }
    await navigator.clipboard.writeText(url);
  };

  const printQr = () => {
    const printSizes: Record<PlateFormat, string> = {
      a6: "A6 portrait",
      a5: "A5 portrait",
      a4: "A4 portrait",
      sticker: "90mm 90mm",
      door: "200mm 100mm",
      window: "300mm 200mm",
    };
    const style = document.createElement("style");
    style.id = "syriasan-print-size";
    style.textContent = `@page { size: ${plateMode ? printSizes[format] : "A6 portrait"}; margin: 0; }`;
    document.head.appendChild(style);
    window.addEventListener("afterprint", () => style.remove(), { once: true });
    window.print();
  };

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-sm" />
        <DialogPrimitive.Content className="qr-print-sheet fixed left-1/2 top-1/2 z-[61] flex max-h-[94vh] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-plate">
        <header className="no-print flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <QrCode className="size-4 text-primary" />
            <DialogPrimitive.Title className="text-sm font-bold">{t({ ar: "نظام QR ولوحة العنوان", en: "QR code and address plate" })}</DialogPrimitive.Title>
          </div>
          <DialogPrimitive.Close aria-label={t({ ar: "إغلاق", en: "Close" })} className="grid size-11 place-items-center rounded-lg border border-border">
            <X className="size-4" />
          </DialogPrimitive.Close>
        </header>

        <div className="no-print flex gap-2 border-b border-border p-3">
          <button
            type="button"
            onClick={() => setPlateMode(false)}
            aria-pressed={!plateMode}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${!plateMode ? "bg-primary text-primary-foreground" : "border border-border"}`}
          >
            <QrCode className="size-3.5" /> {t({ ar: "رمز QR", en: "QR code" })}
          </button>
          <button
            type="button"
            onClick={() => setPlateMode(true)}
            aria-pressed={plateMode}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${plateMode ? "bg-primary text-primary-foreground" : "border border-border"}`}
          >
            <LayoutTemplate className="size-3.5" /> {t({ ar: "إنشاء لوحة عنوان", en: "Create address plate" })}
          </button>
        </div>

        {plateMode ? (
          <div className="no-print flex gap-2 overflow-x-auto border-b border-border p-3">
            {PLATE_FORMATS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormat(option.value)}
                aria-pressed={format === option.value}
                title={option.dimensions}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${format === option.value ? "bg-foreground text-background" : "border border-border"}`}
              >
                {t({ ar: option.label, en: option.labelEn })}
              </button>
            ))}
          </div>
        ) : null}

        <div className="overflow-auto bg-secondary p-4 sm:p-6">
          <div className={`qr-address-plate mx-auto bg-surface text-center text-foreground ${plateMode ? "is-plate" : "is-qr"}`} data-format={format}>
            <div className="plate-brand-row">
              {plateMode && logoUrl ? <img src={logoUrl} alt={t({ ar: `شعار ${title}`, en: `${title} logo` })} className="plate-logo" /> : null}
              <div>
                <p className="plate-brand">SYRIASAN</p>
                <p className="plate-brand-ar">شبكة العنوان الذكي السورية</p>
              </div>
            </div>
            {plateMode ? <h3 className="plate-title">{title}</h3> : null}
            {plateMode && subtitle ? <p className="plate-subtitle">{subtitle}</p> : null}
            <div id={qrId} className="plate-qr">
              <QRCodeSVG value={url} size={240} level="H" bgColor="transparent" fgColor="currentColor" className="size-full text-foreground" />
            </div>
            <p className="plate-code" dir="ltr">{code}</p>
            <p className="plate-scan-ar">امسح للوصول إلى العنوان</p>
            <p className="plate-scan-en" dir="ltr">Scan to Navigate</p>
            {!plateMode ? <p className="plate-privacy">{t({ ar: "يفتح صفحة العنوان المصرّح بها دون إضافة بيانات إلى رمز QR نفسه.", en: "Opens the authorised address page; no personal data is stored inside the QR code itself." })}</p> : null}
          </div>
        </div>

        <div className="no-print grid grid-cols-2 gap-2 border-t border-border p-3 sm:grid-cols-3">
          <button type="button" onClick={() => void downloadQr()} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs font-bold">
            <Download className="size-4" /> {t({ ar: "تنزيل QR", en: "Download QR" })}
          </button>
          <button
            type="button"
            onClick={printQr}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground"
          >
            <Printer className="size-4" />
            {plateMode ? t({ ar: "طباعة اللوحة", en: "Print plate" }) : t({ ar: "طباعة QR", en: "Print QR" })}
          </button>
          <button type="button" onClick={() => void shareQr()} className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-xs font-bold sm:col-span-1">
            <Share2 className="size-4" /> {t({ ar: "مشاركة QR", en: "Share QR" })}
          </button>
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
