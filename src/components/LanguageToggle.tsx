import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

/** Arabic ⇄ English switch. Flips both the language and the page direction. */
export function LanguageToggle({
  className = "",
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  const { lang, setLang, t } = useI18n();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      aria-label={t({ ar: "التبديل إلى الإنجليزية", en: "Switch to Arabic" })}
      title={t({ ar: "English", en: "العربية" })}
      className={`h-9 rounded-md border px-2.5 text-[11px] font-bold shadow-none ${
        inverse
          ? "border-header-foreground/15 bg-header-foreground/5 text-header-muted hover:bg-header-foreground/10 hover:text-header-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      } ${className}`}
    >
      <Languages className="size-4" />
      <span>{lang === "ar" ? "EN" : "ع"}</span>
    </Button>
  );
}
