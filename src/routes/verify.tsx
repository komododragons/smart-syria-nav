import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, MapPin } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { submitVerification, verifierQueue } from "@/lib/network.functions";
import { accessTypeLabel, nodeTypeLabel, verificationLabel } from "@/lib/smart-address";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/verify")({
  head: () => ({
    meta: [
      { title: "توثيق المواقع الميداني" },
      {
        name: "description",
        content: "قائمة المواقع والمداخل بانتظار التوثيق الميداني من الموثقين الميدانيين.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyPage,
});

const LEVEL_OPTIONS = [
  { value: "community_confirmed", ar: "مؤكد مجتمعياً", en: "Community-confirmed" },
  { value: "courier_verified", ar: "موثق من شركة توصيل", en: "Courier-verified" },
  { value: "officially_verified", ar: "توثيق رسمي", en: "Officially verified" },
] as const;

const METHOD_OPTIONS = [
  { value: "field_visit", ar: "زيارة ميدانية", en: "Field visit" },
  { value: "photo_evidence", ar: "صورة توثيقية", en: "Photo evidence" },
  { value: "local_authority", ar: "مصدر محلي رسمي", en: "Local official source" },
  { value: "courier_log", ar: "سجل توصيل ناجح", en: "Successful delivery log" },
] as const;

function VerifyPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queueFn = useServerFn(verifierQueue);
  const submitFn = useServerFn(submitVerification);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [level, setLevel] = useState<string>("community_confirmed");
  const [method, setMethod] = useState<string>("field_visit");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["verifier-queue"],
    queryFn: () => queueFn({ data: undefined as never }),
    enabled: authed === true,
  });

  const verify = async (target: { node_id?: string; access_point_id?: string }) => {
    const id = target.node_id ?? target.access_point_id ?? "";
    setBusyId(id);
    try {
      await submitFn({
        data: {
          node_id: target.node_id ?? null,
          access_point_id: target.access_point_id ?? null,
          level: level as never,
          method,
        },
      });
      toast.success(t({ ar: "تم تسجيل التوثيق ورفع درجة الثقة", en: "Verification recorded and trust score raised" }));
      await queryClient.invalidateQueries({ queryKey: ["verifier-queue"] });
    } catch {
      toast.error(t({ ar: "تعذّر التوثيق — تحتاج صلاحية موثق ميداني", en: "Couldn't verify — field verifier permission required" }));
    } finally {
      setBusyId(null);
    }
  };

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign in required" })}</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/verify" } })}
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
          <h1 className="text-lg font-bold">{t({ ar: "قائمة التوثيق الميداني", en: "Field verification queue" })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t({
              ar: "مواقع ومداخل بمستوى توثيق منخفض. كل توثيق يرفع درجة الثقة +10 ويُسجَّل في سجل التدقيق.",
              en: "Locations and access points with low verification levels. Every verification raises the trust score by +10 and is logged in the audit trail.",
            })}
          </p>
        </div>

        {query.data && !query.data.authorized ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t({ ar: "هذه القائمة مخصصة للموثقين الميدانيين والمراجعين فقط.", en: "This queue is only available to field verifiers and reviewers." })}
          </p>
        ) : null}

        {query.data?.authorized ? (
          <>
            <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-xs">
              <span className="font-bold text-muted-foreground">{t({ ar: "مستوى التوثيق:", en: "Verification level:" })}</span>
              {LEVEL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLevel(option.value)}
                  className={`rounded-full px-3 py-1 ${
                    level === option.value
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {t({ ar: option.ar, en: option.en })}
                </button>
              ))}
              <span className="ms-3 font-bold text-muted-foreground">{t({ ar: "الطريقة:", en: "Method:" })}</span>
              {METHOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  className={`rounded-full px-3 py-1 ${
                    method === option.value
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground"
                  }`}
                >
                  {t({ ar: option.ar, en: option.en })}
                </button>
              ))}
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t({ ar: "مواقع", en: "Locations" })} ({query.data.nodes.length})
              </h2>
              <div className="mt-3 space-y-2">
                {query.data.nodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t({ ar: "لا مواقع بانتظار التوثيق.", en: "No locations awaiting verification." })}</p>
                ) : null}
                {query.data.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                  >
                    <div>
                      <p className="text-sm font-bold">{node.display_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {nodeTypeLabel(node.node_type, lang)} ·{" "}
                        {[node.neighborhood, node.city].filter(Boolean).join(" — ")} ·{" "}
                        {t({ ar: "ثقة", en: "trust" })} {node.confidence_score}%
                      </p>
                      <span className="mt-1 inline-block rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold">
                        {verificationLabel(node.verification_level, lang)}
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      {node.latitude != null ? (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${node.latitude}&mlon=${node.longitude}#map=18/${node.latitude}/${node.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground"
                          aria-label={t({ ar: "فتح الموقع على الخريطة", en: "Open location on the map" })}
                        >
                          <MapPin className="size-3.5" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === node.id}
                        onClick={() => verify({ node_id: node.id })}
                        className="flex items-center gap-1.5 rounded-lg bg-allow px-3 py-2 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                      >
                        <BadgeCheck className="size-3.5" /> {t({ ar: "توثيق", en: "Verify" })}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t({ ar: "مداخل ونقاط وصول", en: "Entrances and access points" })} ({query.data.access_points.length})
              </h2>
              <div className="mt-3 space-y-2">
                {query.data.access_points.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t({ ar: "لا مداخل بانتظار التوثيق.", en: "No access points awaiting verification." })}</p>
                ) : null}
                {query.data.access_points.map((ap) => (
                  <div
                    key={ap.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3"
                  >
                    <div>
                      <p className="text-sm font-bold">{ap.display_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {accessTypeLabel(ap.access_type, lang)} ·{" "}
                        {ap.location_nodes?.display_name ?? ""} · {t({ ar: "ثقة", en: "trust" })} {ap.confidence_score}%
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === ap.id}
                      onClick={() => verify({ access_point_id: ap.id })}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-allow px-3 py-2 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                    >
                      <BadgeCheck className="size-3.5" /> {t({ ar: "توثيق", en: "Verify" })}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p>
        ) : null}
      </main>
    </div>
  );
}
