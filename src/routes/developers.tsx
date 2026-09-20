import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound, Plus } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  createApiClient,
  createApiKey,
  listApiClients,
  revokeApiKey,
} from "@/lib/network.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "واجهة المطورين وAPI" },
      {
        name: "description",
        content:
          "أنشئ مفاتيح API لحلّ العناوين الذكية العامة برمجياً — لشركات التوصيل والخدمات اللوجستية وخدمات الطوارئ.",
      },
      { property: "og:title", content: "واجهة المطورين — شبكة العنوان الذكي" },
      {
        property: "og:description",
        content: "حلّل أي عنوان ذكي عام إلى إحداثيات المدخل الصحيح حسب الغرض عبر واجهة برمجية عامة.",
      },
    ],
  }),
  component: DevelopersPage,
});

function DevelopersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listApiClients);
  const createClientFn = useServerFn(createApiClient);
  const createKeyFn = useServerFn(createApiKey);
  const revokeFn = useServerFn(revokeApiKey);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"live" | "test">("live");
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["api-clients"],
    queryFn: () => listFn({ data: undefined as never }),
    enabled: authed === true,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["api-clients"] });

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign-in required" })}</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/developers" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            {t({ ar: "الدخول", en: "Sign in" })}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <div>
          <h1 className="text-lg font-bold">{t({ ar: "واجهة المطورين", en: "Developer API" })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t({ ar: "حلّل العناوين الذكية العامة برمجياً. النقطة العامة:", en: "Resolve public smart addresses programmatically. Public endpoint:" })}
          </p>
          <code
            dir="ltr"
            className="mt-2 block rounded-lg border border-border bg-surface p-3 font-mono text-[11px]"
          >
            GET /api/public/resolve?code=SY-DAM-K7X4&purpose=parcel_delivery{"\n"}
            Header: x-api-key: san_live_…
          </code>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t({ ar: "المفتاح اختياري للاستخدام العام المحدود، وإلزامي لتتبع الاستهلاك ورفع حدود المعدل.", en: "The key is optional for limited public use, and required for usage tracking and higher rate limits." })}
          </p>
          <Link
            to="/checkout-component"
            className="mt-3 inline-flex rounded-lg border border-primary/50 px-3 py-2 text-xs font-bold text-primary"
          >
            {t({ ar: "مكوّن العنوان للمتاجر الإلكترونية (WooCommerce / Shopify / مخصص)", en: "Address component for online stores (WooCommerce / Shopify / custom)" })}
          </Link>
          <Link
            to="/docs"
            className="mt-2 inline-flex rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
          >
            {t({ ar: "بوابة المطورين: توثيق كامل + أمثلة + وضع اختبار", en: "Developer portal: full docs + examples + sandbox mode" })}
          </Link>
          <Link
            to="/widget"
            className="mt-2 inline-flex rounded-lg border border-primary/50 px-3 py-2 text-xs font-bold text-primary"
          >
            {t({ ar: "أداة العنوان القابلة للتضمين (سطر واحد + بروتوكول الحزم)", en: "Embeddable address widget (one line + package protocol)" })}
          </Link>
          <Link
            to="/api-reference"
            className="mt-2 inline-flex rounded-lg border border-primary/50 px-3 py-2 text-xs font-bold text-primary"
          >
            {t({ ar: "مرجع الواجهة البرمجية v1 (العناوين، الحلّ، البحث، المسارات، QR)", en: "API v1 reference (addresses, resolve, search, routes, QR)" })}
          </Link>
        </div>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t({ ar: "عميل API جديد", en: "New API client" })}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t({ ar: "اسم التطبيق أو الشركة", en: "App or company name" })}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <div className="flex gap-1.5 text-xs">
              {(["live", "test"] as const).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`rounded-lg px-3 py-2 font-bold ${
                    environment === env
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {env === "live" ? t({ ar: "إنتاج", en: "Live" }) : t({ ar: "تجريبي", en: "Test" })}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || name.trim().length < 2}
              onClick={async () => {
                setBusy(true);
                try {
                  await createClientFn({ data: { name: name.trim(), environment } });
                  setName("");
                  toast.success(t({ ar: "تم إنشاء العميل", en: "Client created" }));
                  await refresh();
                } catch {
                  toast.error(t({ ar: "تعذر إنشاء العميل", en: "Couldn't create the client" }));
                } finally {
                  setBusy(false);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="size-3.5" /> {t({ ar: "إنشاء", en: "Create" })}
            </button>
          </div>
        </section>

        {freshKey ? (
          <section className="rounded-2xl border border-primary/40 bg-surface p-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary">
              {t({ ar: "مفتاحك الجديد — يُعرض مرة واحدة فقط", en: "Your new key — shown only once" })}
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <code dir="ltr" className="flex-1 break-all rounded-lg bg-background p-3 font-mono text-xs">
                {freshKey}
              </code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(freshKey);
                  toast.success(t({ ar: "تم النسخ", en: "Copied" }));
                }}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-border"
                aria-label={t({ ar: "نسخ المفتاح", en: "Copy key" })}
              >
                <Copy className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {t({ ar: "نخزّن بصمة المفتاح فقط — لا يمكن استرجاعه لاحقاً. احفظه الآن.", en: "We only store a fingerprint of the key — it can't be retrieved later. Save it now." })}
            </p>
          </section>
        ) : null}

        {query.data?.clients.map((client) => {
          const clientKeys = (query.data?.keys ?? []).filter((k) => k.client_id === client.id);
          return (
            <section key={client.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{client.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {client.environment === "live" ? t({ ar: "إنتاج", en: "Live" }) : t({ ar: "تجريبي", en: "Test" })} ·{" "}
                    {t({ ar: "حد المعدل", en: "Rate limit" })} {client.rate_limit_per_minute}
                    {t({ ar: "/دقيقة", en: "/min" })}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const result = await createKeyFn({ data: { client_id: client.id } });
                      setFreshKey(result.key);
                      await refresh();
                    } catch {
                      toast.error(t({ ar: "تعذر إنشاء المفتاح", en: "Couldn't create the key" }));
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[11px] font-bold text-background disabled:opacity-50"
                >
                  <KeyRound className="size-3.5" /> {t({ ar: "مفتاح جديد", en: "New key" })}
                </button>
              </div>
              {clientKeys.length ? (
                <div className="mt-3 space-y-1.5">
                  {clientKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background p-2 text-[11px]"
                    >
                      <span dir="ltr" className="font-mono">
                        {key.key_prefix}…
                      </span>
                      {key.revoked ? (
                        <span className="font-bold text-prohibit">{t({ ar: "ملغى", en: "Revoked" })}</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await revokeFn({ data: { id: key.id } });
                              toast.success(t({ ar: "تم إلغاء المفتاح", en: "Key revoked" }));
                              await refresh();
                            } catch {
                              toast.error(t({ ar: "تعذر الإلغاء", en: "Couldn't revoke the key" }));
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="rounded-md border border-border px-2 py-1 font-bold text-muted-foreground disabled:opacity-50"
                        >
                          {t({ ar: "إلغاء", en: "Revoke" })}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[11px] text-muted-foreground">{t({ ar: "لا مفاتيح بعد.", en: "No keys yet." })}</p>
              )}
            </section>
          );
        })}

        {query.data?.clients.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t({ ar: "لا عملاء API بعد — أنشئ أول عميل لتوليد مفتاح.", en: "No API clients yet — create your first client to generate a key." })}
          </p>
        ) : null}
      </main>
    </div>
  );
}
