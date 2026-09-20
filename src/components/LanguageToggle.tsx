import { Languages } from "lucide-react";

import { useI18n } from "@/lib/i18n";

/** Arabic ⇄ English switch. Flips both the language and the page direction. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLang(lang === "ar" ? "en" : "ar")}
      aria-label={t({ ar: "التبديل إلى الإنجليزية", en: "Switch to Arabic" })}
      title={t({ ar: "English", en: "العربية" })}
      className={`flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground ${className}`}
    >
      <Languages className="size-4" />
      <span>{lang === "ar" ? "EN" : "ع"}</span>
    </button>
  );
}
