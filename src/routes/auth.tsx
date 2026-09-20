import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useI18n } from "@/lib/i18n";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "الدخول إلى شبكة العنوان الذكي" },
      {
        name: "description",
        content: "سجّل الدخول لإدارة عناوينك الذكية، وإنشاء عناوين مؤقتة، ومتابعة حالة التوثيق.",
      },
      { property: "og:title", content: "الدخول — شبكة العنوان الذكي السورية" },
      { property: "og:description", content: "حساب واحد لإدارة عناوينك الذكية وصلاحيات الوصول إليها." },
    ],
  }),
  component: AuthPage,
});

function safePath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { redirect } = Route.useSearch();
  const next = safePath(redirect);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        toast.success(t({ ar: "تم إنشاء الحساب", en: "Account created" }));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: next });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t({ ar: "تعذر إتمام العملية", en: "Couldn't complete this action" }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${next}`,
    });
    if (result.error) {
      toast.error(t({ ar: "تعذر الدخول عبر Google", en: "Couldn't sign in with Google" }));
      return;
    }
    if (result.redirected) return;
    navigate({ to: next });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-2xl font-bold">
          {mode === "signin"
            ? t({ ar: "الدخول إلى الشبكة", en: "Sign in to the network" })
            : t({ ar: "حساب جديد", en: "Create an account" })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t({
            ar: "حسابك يُستخدم لإدارة عناوينك وصلاحيات الوصول. العناوين السكنية تبقى خاصة افتراضياً.",
            en: "Your account manages your addresses and who can access them. Residential addresses stay private by default.",
          })}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="email"
            required
            dir="ltr"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {mode === "signin" ? t({ ar: "دخول", en: "Sign in" }) : t({ ar: "إنشاء الحساب", en: "Create account" })}
          </button>
        </form>

        <button
          type="button"
          onClick={google}
          className="mt-3 w-full rounded-lg border border-border bg-surface py-3 text-sm font-bold"
        >
          {t({ ar: "المتابعة عبر Google", en: "Continue with Google" })}
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-6 w-full text-center text-xs text-muted-foreground underline"
        >
          {mode === "signin"
            ? t({ ar: "ليس لديك حساب؟ أنشئ حساباً", en: "Don't have an account? Create one" })
            : t({ ar: "لدي حساب — تسجيل الدخول", en: "Already have an account? Sign in" })}
        </button>
      </main>
    </div>
  );
}
