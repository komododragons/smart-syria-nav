import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AdminControlCenter } from "@/components/admin/AdminControlCenter";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "مركز التحكم الإداري — سيرياسان" },
      { name: "description", content: "مركز تشغيل وإدارة الشبكة السورية للعنوان الذكي." },
      { property: "og:title", content: "مركز التحكم الإداري — سيرياسان" },
      { property: "og:description", content: "مركز تشغيل وإدارة الشبكة السورية للعنوان الذكي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session))); }, []);

  return <div className="min-h-screen bg-background text-foreground"><AppHeader /><main id="main-content" className="mx-auto max-w-[96rem] px-3 py-4 sm:px-5">{authed === false ? <div className="mx-auto max-w-md py-20 text-center"><h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign-in required" })}</h1><Button className="mt-6" onClick={() => navigate({ to: "/auth", search: { redirect: "/admin" } })}>{t({ ar: "الدخول", en: "Sign in" })}</Button></div> : authed === true ? <AdminControlCenter /> : <p role="status" className="py-20 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحقق…", en: "Checking access…" })}</p>}</main></div>;
}