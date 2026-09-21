import { useI18n } from "@/lib/i18n";

/**
 * Phase 27 — the core product loop.
 * Create → Code → Share → Resolve → Navigate → Arrive → Confirm → Quality improves.
 * Rendered compactly wherever the user is standing inside the loop, so every
 * major screen shows what just happened and what the next step is.
 */
export const LOOP_STEPS = [
  { key: "create", ar: "أنشئ العنوان", en: "Create address" },
  { key: "code", ar: "استلم الرمز", en: "Receive code" },
  { key: "share", ar: "شارك الرمز / QR", en: "Share code / QR" },
  { key: "resolve", ar: "يحلّه المستلم", en: "Recipient resolves" },
  { key: "navigate", ar: "التوجيه", en: "Navigate" },
  { key: "arrive", ar: "الوصول للمدخل الصحيح", en: "Arrive at right entrance" },
  { key: "confirm", ar: "تأكيد أو تصحيح", en: "Confirm / correct" },
  { key: "quality", ar: "تتحسن جودة العنوان", en: "Quality improves" },
] as const;

export type LoopStep = (typeof LOOP_STEPS)[number]["key"];

export function LoopStepper({
  current,
  className = "",
}: {
  current: LoopStep;
  className?: string;
}) {
  const { t } = useI18n();
  const index = LOOP_STEPS.findIndex((s) => s.key === current);

  return (
    <nav
      aria-label={t({ ar: "دورة العنوان الذكي", en: "Smart address loop" })}
      className={`flex items-center gap-1 overflow-x-auto pb-1 ${className}`}
    >
      {LOOP_STEPS.map((step, i) => {
        const done = i < index;
        const active = i === index;
        return (
          <span
            key={step.key}
            className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : done
                  ? "border-border bg-secondary text-foreground"
                  : "border-border bg-background text-muted-foreground"
            }`}
          >
            {t(step)}
          </span>
        );
      })}
    </nav>
  );
}
