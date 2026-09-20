/**
 * Phase 25 — mobile-first bottom navigation.
 *
 * Couriers and residents use Syriasan one-handed, often while walking or
 * driving. The four destinations they actually need sit in a thumb-reachable
 * bar with 56px targets; everything else lives behind "المزيد" so the top
 * header stays clean on small screens.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Code2,
  CloudDownload,
  Landmark,
  Layers,
  LayoutDashboard,
  MapPinPlus,
  Menu,
  QrCode,
  Search,
  ShieldCheck,
  Truck,
  User,
  Wallet,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useLowData } from "@/lib/low-data";

const HIDDEN_PREFIXES = ["/widget", "/embed", "/d/", "/e/"];

export function MobileTabBar() {
  const { t } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const { lowData, setLowData } = useLowData();

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  const tabClass = (active: boolean) =>
    `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold ${
      active ? "bg-primary/10 text-primary" : "text-muted-foreground"
    }`;

  const moreLinks = [
    { to: "/places", icon: Landmark, label: { ar: "الأماكن العامة", en: "Public places" } },
    { to: "/create", icon: MapPinPlus, label: { ar: "إنشاء عنوان ذكي", en: "Create an address" } },
    { to: "/offline", icon: CloudDownload, label: { ar: "العمل دون اتصال", en: "Offline mode" } },
    { to: "/plans", icon: Layers, label: { ar: "الخطط", en: "Plans" } },
    ...(signedIn
      ? [
          { to: "/dashboard", icon: LayoutDashboard, label: { ar: "لوحة الأعمال", en: "Business dashboard" } },
          { to: "/vault", icon: Wallet, label: { ar: "خزنة العناوين", en: "Address vault" } },
          { to: "/courier", icon: Truck, label: { ar: "مسارات التوصيل", en: "Delivery routes" } },
          { to: "/verify", icon: BadgeCheck, label: { ar: "التوثيق الميداني", en: "Field verification" } },
          { to: "/privacy", icon: ShieldCheck, label: { ar: "مركز الخصوصية", en: "Privacy centre" } },
          { to: "/developers", icon: Code2, label: { ar: "واجهة المطورين", en: "Developer tools" } },
        ]
      : [{ to: "/docs", icon: Code2, label: { ar: "دليل المطورين", en: "Developer docs" } }]),
  ] as const;

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t({ ar: "إغلاق القائمة", en: "Close menu" })}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-foreground/50"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-bold">{t({ ar: "المزيد", en: "More" })}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t({ ar: "إغلاق", en: "Close" })}
                className="grid size-10 place-items-center rounded-lg border border-border"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {moreLinks.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex min-h-14 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold"
                >
                  <item.icon className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 truncate">{t(item.label)}</span>
                </Link>
              ))}
            </div>
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={() => setLowData(!lowData)}
                aria-pressed={lowData}
                className={`flex min-h-14 w-full items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold ${
                  lowData ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background"
                }`}
              >
                <span>{t({ ar: "وضع توفير البيانات", en: "Data saver" })}</span>
                <span>{lowData ? t({ ar: "مفعّل", en: "On" }) : t({ ar: "متوقف", en: "Off" })}</span>
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t({
                  ar: "يوقف تحميل صور الخريطة على الشبكات البطيئة، وتبقى العناوين والمسارات تعمل.",
                  en: "Stops map imagery from loading on slow networks; addresses and routes keep working.",
                })}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label={t({ ar: "التنقل السريع", en: "Quick navigation" })}
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-1 border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur-md md:hidden"
      >
        <Link to="/" className={tabClass(pathname === "/")}>
          <Search className="size-5" />
          {t({ ar: "المحلّل", en: "Resolve" })}
        </Link>
        <Link to="/search" className={tabClass(pathname.startsWith("/search"))}>
          <Landmark className="size-5" />
          {t({ ar: "بحث", en: "Search" })}
        </Link>
        <Link to="/scan" className={tabClass(pathname.startsWith("/scan"))}>
          <QrCode className="size-5" />
          {t({ ar: "مسح", en: "Scan" })}
        </Link>
        {signedIn ? (
          <Link to="/my-addresses" className={tabClass(pathname.startsWith("/my-addresses"))}>
            <User className="size-5" />
            {t({ ar: "عناويني", en: "Mine" })}
          </Link>
        ) : (
          <Link to="/auth" className={tabClass(pathname.startsWith("/auth"))}>
            <User className="size-5" />
            {t({ ar: "الدخول", en: "Sign in" })}
          </Link>
        )}
        <button type="button" onClick={() => setOpen(true)} className={tabClass(false)}>
          <Menu className="size-5" />
          {t({ ar: "المزيد", en: "More" })}
        </button>
      </nav>
      {/* Keeps page content clear of the fixed bar. The home screen is a
          full-height split view that scrolls internally, so it pads itself. */}
      {pathname === "/" ? null : (
        <div aria-hidden className="h-[calc(4.25rem+env(safe-area-inset-bottom))] md:hidden" />
      )}
    </>
  );
}
