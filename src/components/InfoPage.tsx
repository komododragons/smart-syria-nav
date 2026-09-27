import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type L = { ar: string; en: string };

export function InfoPage({
  title,
  intro,
  sections,
  actions,
  children,
}: {
  title: L;
  intro: L;
  sections: { heading: L; body: L }[];
  actions?: { to: string; label: L; primary?: boolean }[];
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main id="main-content" className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">{t(title)}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{t(intro)}</p>
        {actions && (
          <div className="mt-6 flex flex-wrap gap-2">
            {actions.map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className={buttonVariants({ variant: a.primary ? "default" : "outline" })}
              >
                {t(a.label)}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-8 space-y-6">
          {sections.map((s) => (
            <section key={s.heading.en} className="rounded-lg border bg-card p-5">
              <h2 className="text-lg font-bold">{t(s.heading)}</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{t(s.body)}</p>
            </section>
          ))}
        </div>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function infoHead(title: string, description: string) {
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
