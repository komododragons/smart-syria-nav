/**
 * Phase 25 — QR scanning.
 *
 * Address plates, stickers and delivery slips carry a Syriasan QR. Couriers
 * scan it here with the phone's rear camera; the page uses the built-in
 * BarcodeDetector (no scanning library, no extra bytes) and always keeps a
 * manual code field as the fallback for browsers or cameras that refuse.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard, QrCode } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/lib/i18n";
import { extractSyriasanCode } from "@/lib/qr";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "مسح رمز QR — سيرياسان" },
      {
        name: "description",
        content: "امسح رمز QR الموجود على لوحة العنوان أو الطرد للوصول مباشرة إلى العنوان الذكي.",
      },
      { property: "og:title", content: "مسح رمز QR للعنوان الذكي — سيرياسان" },
      {
        property: "og:description",
        content: "كاميرا الهاتف تكفي: امسح لوحة العنوان وابدأ التوجيه إلى المدخل الصحيح.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanPage,
});

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** Pulls a Syriasan code out of a raw QR payload (bare code or full URL). */
const extractCode = extractSyriasanCode;

function ScanPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const supported = typeof window !== "undefined" && "BarcodeDetector" in window;

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => stop, [stop]);

  const go = useCallback(
    (code: string) => {
      stop();
      void navigate({ to: "/a/$code", params: { code } });
    },
    [navigate, stop],
  );

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError(
        t({
          ar: "متصفحك لا يدعم قراءة رموز QR. استخدم تطبيق الكاميرا ثم افتح الرابط، أو أدخل الرمز يدوياً.",
          en: "This browser cannot read QR codes. Use the camera app and open the link, or type the code below.",
        }),
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setScanning(true);
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const DetectorCtor = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => Detector })
        .BarcodeDetector;
      const detector = new DetectorCtor({ formats: ["qr_code"] });

      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const results = await detector.detect(video);
          for (const result of results) {
            const code = extractCode(result.rawValue);
            if (code) {
              go(code);
              return;
            }
          }
        } catch {
          /* frame not ready */
        }
        window.setTimeout(() => void tick(), 350);
      };
      void tick();
    } catch {
      setScanning(false);
      setError(
        t({
          ar: "تعذّر تشغيل الكاميرا. تحقق من إذن الكاميرا أو أدخل الرمز يدوياً.",
          en: "The camera could not start. Check the camera permission or type the code below.",
        }),
      );
    }
  }, [go, supported, t]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-lg px-4 py-5">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <QrCode className="size-5 text-primary" />
          {t({ ar: "مسح رمز العنوان", en: "Scan an address code" })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t({
            ar: "وجّه الكاميرا نحو لوحة العنوان أو ملصق الطرد. يفتح العنوان مباشرة مع المدخل الصحيح.",
            en: "Point the camera at an address plate or parcel label. The matching entrance opens straight away.",
          })}
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="relative aspect-square w-full bg-foreground/90">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`size-full object-cover ${scanning ? "" : "hidden"}`}
            />
            {!scanning ? (
              <div className="absolute inset-0 grid place-items-center text-background">
                <CameraOff className="size-10 opacity-60" />
              </div>
            ) : (
              <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-primary" />
            )}
          </div>
          <div className="p-3">
            {scanning ? (
              <button
                type="button"
                onClick={stop}
                className="min-h-14 w-full rounded-xl border border-border text-sm font-bold"
              >
                {t({ ar: "إيقاف الكاميرا", en: "Stop camera" })}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void start()}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
              >
                <Camera className="size-5" />
                {t({ ar: "تشغيل الكاميرا", en: "Start camera" })}
              </button>
            )}
            <div role="status" aria-live="polite" className="sr-only">
              {scanning ? t({ ar: "الكاميرا تعمل وجارٍ البحث عن رمز", en: "Camera active and looking for a code" }) : ""}
            </div>
            {error ? <p role="alert" className="mt-2 rounded-md bg-prohibit-surface p-3 text-xs font-bold text-prohibit">{error}</p> : null}
          </div>
        </div>

        <form
          className="mt-4 rounded-2xl border border-border bg-surface p-3"
          onSubmit={(event) => {
            event.preventDefault();
             const code = extractCode(manual);
             if (code) {
               setError(null);
               go(code);
               return;
             }
             setError(
               t({
                 ar: "أدخل رمز سيرياسان صالحاً، مثل SY-DAM-0001.",
                 en: "Enter a valid Syriasan code, such as SY-DAM-0001.",
               }),
             );
          }}
        >
          <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground" htmlFor="manual-code">
            <Keyboard className="size-4" />
            {t({ ar: "أو أدخل الرمز يدوياً", en: "Or type the code" })}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="manual-code"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              inputMode="text"
              autoCapitalize="characters"
              spellCheck={false}
              dir="ltr"
              placeholder="SY-DAM-0001"
              className="min-h-14 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 font-mono text-base"
            />
            <button
              type="submit"
               aria-label={t({ ar: "فتح العنوان", en: "Open address" })}
              className="min-h-14 rounded-xl bg-foreground px-4 text-sm font-bold text-background"
            >
              {t({ ar: "فتح", en: "Open" })}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
