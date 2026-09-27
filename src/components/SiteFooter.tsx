import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

const links = [
  { to: "/how-it-works", label: { ar: "كيف يعمل", en: "How it works" } },
  { to: "/for-couriers", label: { ar: "لشركات التوصيل", en: "For couriers" } },
  { to: "/offline", label: { ar: "دون اتصال", en: "Offline" } },
  { to: "/plans", label: { ar: "الخطط", en: "Plans" } },
  { to: "/about", label: { ar: "من نحن", en: "About" } },
  { to: "/contact", label: { ar: "تواصل معنا", en: "Contact" } },
  { to: "/privacy-policy", label: { ar: "سياسة الخصوصية", en: "Privacy" } },
  { to: "/terms", label: { ar: "الشروط", en: "Terms" } },
] as const;

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-12 border-t bg-muted/40 pb-24 md:pb-6">
      <nav
        aria-label={t({ ar: "روابط ثانوية", en: "Secondary links" })}
        className="mx-auto flex max-w-7xl flex-wrap gap-x-5 gap-y-2 px-4 py-5 text-sm text-muted-foreground"
      >
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="hover:text-foreground">
            {t(l.label)}
          </Link>
        ))}
        <span className="ms-auto">© {t({ ar: "سيريا سان", en: "Syriasan" })}</span>
      </nav>
    </footer>
  );
}
