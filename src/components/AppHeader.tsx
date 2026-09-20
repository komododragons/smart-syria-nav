import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CloudDownload,
  Code2,
  LogOut,
  MapPinPlus,
  Search,
  ShieldCheck,
  Truck,
  Landmark,
  Layers,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";

export function AppHeader() {
  const router = useRouter();
  const { t } = useI18n();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSignedIn(Boolean(session));
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl min-w-0 items-center justify-between gap-3">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <span className="truncate text-base font-bold tracking-tight md:text-lg underline decoration-primary decoration-2 underline-offset-4">
            {t({ ar: "شبكة العنوان الذكي", en: "Smart Address Network" })}
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <LanguageToggle />
          <Link
            to="/search"
            className="hidden md:grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t({ ar: "البحث", en: "Search" })}
          >
            <Search className="size-4" />
          </Link>
          <Link
            to="/places"
            className="hidden md:grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t({ ar: "دليل الأماكن العامة", en: "Public places directory" })}
          >
            <Landmark className="size-4" />
          </Link>
          <Link
            to="/offline"
            className="hidden md:grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t({ ar: "العمل دون اتصال", en: "Offline mode" })}
          >
            <CloudDownload className="size-4" />
          </Link>
          <Link
            to="/plans"
            className="hidden md:grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t({ ar: "الخطط", en: "Plans" })}
          >
            <Layers className="size-4" />
          </Link>
          <Link
            to="/create"
            className="hidden md:grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t({ ar: "إنشاء عنوان ذكي", en: "Create a smart address" })}
          >
            <MapPinPlus className="size-4" />
          </Link>
          {signedIn ? (
            <>
              <Link
                to="/privacy"
                className="hidden md:grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t({ ar: "مركز الخصوصية", en: "Privacy centre" })}
              >
                <ShieldCheck className="size-4" />
              </Link>
              <Link
                to="/verify"
                className="hidden md:grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t({ ar: "التوثيق الميداني", en: "Field verification" })}
              >
                <BadgeCheck className="size-4" />
              </Link>
              <Link
                to="/courier"
                className="hidden md:grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t({ ar: "مسارات التوصيل", en: "Delivery routes" })}
              >
                <Truck className="size-4" />
              </Link>
              <Link
                to="/developers"
                className="hidden md:grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t({ ar: "واجهة المطورين", en: "Developer tools" })}
              >
                <Code2 className="size-4" />
              </Link>
              <Link
                to="/dashboard"
                className="hidden md:block rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
              >
                {t({ ar: "لوحة الأعمال", en: "Business dashboard" })}
              </Link>
              <Link
                to="/vault"
                className="hidden md:block rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
              >
                {t({ ar: "خزنة العناوين", en: "Address vault" })}
              </Link>
              <Link
                to="/my-addresses"
                className="hidden md:block rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
              >
                {t({ ar: "عناويني", en: "My addresses" })}
              </Link>
              <button
                type="button"
                aria-label={t({ ar: "تسجيل الخروج", en: "Sign out" })}
                onClick={async () => {
                  await supabase.auth.signOut();
                  router.navigate({ to: "/" });
                }}
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground"
              >
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background"
            >
              <ShieldCheck className="size-3.5" />
              {t({ ar: "الدخول", en: "Sign in" })}
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
