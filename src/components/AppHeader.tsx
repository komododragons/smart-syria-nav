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
  Menu,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/syriasan-logo.png.asset.json";

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

  const publicLinks = [
    { to: "/search", icon: Search, label: { ar: "البحث", en: "Search" }, primary: false },
    { to: "/places", icon: Landmark, label: { ar: "الأماكن العامة", en: "Public places" }, primary: false },
    { to: "/create", icon: MapPinPlus, label: { ar: "عنوان جديد", en: "New address" }, primary: true },
    { to: "/offline", icon: CloudDownload, label: { ar: "دون اتصال", en: "Offline" }, primary: false },
    { to: "/plans", icon: Layers, label: { ar: "الخطط", en: "Plans" }, primary: false },
  ] as const;

  const accountLinks = signedIn
    ? ([
        { to: "/my-addresses", icon: MapPinPlus, label: { ar: "عناويني", en: "My addresses" } },
        { to: "/dashboard", icon: Landmark, label: { ar: "الأعمال", en: "Business" } },
        { to: "/vault", icon: ShieldCheck, label: { ar: "الخزنة", en: "Vault" } },
        { to: "/privacy", icon: ShieldCheck, label: { ar: "الخصوصية", en: "Privacy" } },
        { to: "/verify", icon: BadgeCheck, label: { ar: "التوثيق", en: "Verify" } },
        { to: "/courier", icon: Truck, label: { ar: "التوصيل", en: "Delivery" } },
        { to: "/developers", icon: Code2, label: { ar: "المطورون", en: "Developers" } },
      ] as const)
    : ([{ to: "/docs", icon: Code2, label: { ar: "المطورون", en: "Developers" } }] as const);

  return (
    <header className="sticky top-0 z-50 border-b border-header-foreground/10 bg-header text-header-foreground shadow-sm">
      <div className="mx-auto grid min-h-14 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
        <Link
          to="/"
          aria-label={t({ ar: "سيريا سان — الصفحة الرئيسية", en: "Syriasan — home" })}
          className="flex min-w-0 items-center gap-2.5"
        >
          <img
            src={logoAsset.url}
            alt=""
            aria-hidden="true"
            width={48}
            height={48}
            className="size-11 shrink-0 object-contain md:size-12"
          />
          <span className="flex min-w-0 flex-col leading-none">
            <span className="truncate text-lg font-bold">{t({ ar: "سيريا سان", en: "Syriasan" })}</span>
            <span className="mt-1.5 truncate text-xs font-semibold text-header-muted md:text-sm">
            {t({ ar: "شبكة العنوان الذكي السورية", en: "Syrian Smart Address Network" })}
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2">
          <LanguageToggle inverse />
          {signedIn ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t({ ar: "تسجيل الخروج", en: "Sign out" })}
              title={t({ ar: "تسجيل الخروج", en: "Sign out" })}
              onClick={async () => {
                await supabase.auth.signOut();
                router.navigate({ to: "/" });
              }}
              className="border border-header-foreground/15 bg-header-foreground/5 text-header-muted shadow-none hover:bg-header-foreground/10 hover:text-header-foreground"
            >
              <LogOut />
            </Button>
          ) : (
            <Link
              to="/auth"
              className={cn(
                buttonVariants({ size: "sm" }),
                "border border-header-foreground/15 bg-header-foreground/10 text-header-foreground shadow-none hover:bg-header-foreground/15",
              )}
              activeProps={{ "aria-current": "page" }}
            >
              <ShieldCheck />
              {t({ ar: "دخول", en: "Sign in" })}
            </Link>
          )}
        </div>
      </div>

      <nav
        aria-label={t({ ar: "التنقل الرئيسي", en: "Primary navigation" })}
        className="border-t border-header-foreground/10 bg-header-subtle"
      >
        <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 py-1.5">
          {publicLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex h-10 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-bold text-header-muted transition-colors hover:bg-header-foreground/10 hover:text-header-foreground md:px-3 md:text-xs",
                item.primary && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              <span>{t(item.label)}</span>
            </Link>
          ))}

          <span className="mx-1 h-5 w-px shrink-0 bg-header-foreground/10" aria-hidden />

          {accountLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="hidden h-10 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-bold text-header-muted transition-colors hover:bg-header-foreground/10 hover:text-header-foreground md:flex"
              activeProps={{ "aria-current": "page" }}
            >
              <item.icon className="size-4 shrink-0" />
              <span>{t(item.label)}</span>
            </Link>
          ))}

          <span className="ms-auto hidden items-center gap-1.5 px-2 text-[10px] font-medium text-header-muted xl:flex">
            <Menu className="size-3.5" />
            {t({ ar: "خدمات العنوان", en: "Address services" })}
          </span>
        </div>
      </nav>
    </header>
  );
}
