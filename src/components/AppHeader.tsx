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

export function AppHeader() {
  const router = useRouter();
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
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight underline decoration-primary decoration-2 underline-offset-4">
            شبكة العنوان الذكي
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            to="/search"
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label="البحث"
          >
            <Search className="size-4" />
          </Link>
          <Link
            to="/places"
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label="دليل الأماكن العامة"
          >
            <Landmark className="size-4" />
          </Link>
          <Link
            to="/offline"
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label="العمل دون اتصال"
          >
            <CloudDownload className="size-4" />
          </Link>
          <Link
            to="/plans"
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label="الخطط"
          >
            <Layers className="size-4" />
          </Link>
          <Link
            to="/create"
            className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
            aria-label="إنشاء عنوان ذكي"
          >
            <MapPinPlus className="size-4" />
          </Link>
          {signedIn ? (
            <>
              <Link
                to="/privacy"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label="مركز الخصوصية"
              >
                <ShieldCheck className="size-4" />
              </Link>
              <Link
                to="/verify"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label="التوثيق الميداني"
              >
                <BadgeCheck className="size-4" />
              </Link>
              <Link
                to="/courier"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label="مسارات التوصيل"
              >
                <Truck className="size-4" />
              </Link>
              <Link
                to="/developers"
                className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
                aria-label="واجهة المطورين"
              >
                <Code2 className="size-4" />
              </Link>
              <Link
                to="/dashboard"
                className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
              >
                لوحة الأعمال
              </Link>
              <Link
                to="/vault"
                className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
              >
                خزنة العناوين
              </Link>
              <Link
                to="/my-addresses"
                className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground"
              >
                عناويني
              </Link>
              <button
                type="button"
                aria-label="تسجيل الخروج"
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
              الدخول
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
