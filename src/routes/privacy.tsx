import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Link2Off, Lock, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_PRIVACY,
  myPrivacy,
  mySharingActivity,
  revokeAllShares,
  revokeShare,
  updatePrivacy,
  type PrivacyPreferences,
} from "@/lib/privacy.functions";

const card = "rounded-2xl border border-border bg-surface p-4";
const toggleRow =
  "flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm";

const TOGGLES: (keyof PrivacyPreferences)[] = [
  "allow_share_phone",
  "allow_share_unit",
  "allow_share_floor",
  "allow_share_name",
  "allow_share_instructions",
  "allow_share_parking",
];

const PRIVACY_LABELS: Record<keyof PrivacyPreferences, { ar: string; en: string }> = {
  allow_share_phone: { ar: "مشاركة الهاتف", en: "Share phone number" },
  allow_share_unit: { ar: "مشاركة رقم الشقة", en: "Share unit number" },
  allow_share_floor: { ar: "مشاركة الطابق", en: "Share floor" },
  allow_share_name: { ar: "مشاركة الاسم", en: "Share name" },
  allow_share_instructions: { ar: "مشاركة تعليمات الوصول", en: "Share access instructions" },
  allow_share_parking: { ar: "مشاركة معلومات المواقف", en: "Share parking information" },
  default_share_hours: { ar: "المدة الافتراضية للمشاركة (ساعات)", en: "Default share duration (hours)" },
  max_share_hours: { ar: "الحد الأقصى لمدة المشاركة (ساعات)", en: "Maximum share duration (hours)" },
};

const HELP: Partial<Record<keyof PrivacyPreferences, { ar: string; en: string }>> = {
  allow_share_phone: {
    ar: "لا يُدرج رقمك في أي رابط مشاركة عند الإيقاف.",
    en: "Your phone number is left out of any share link while this is off.",
  },
  allow_share_unit: {
    ar: "رقم الشقة لا يظهر أبداً في البحث العام، وعند الإيقاف لا يظهر حتى في الروابط.",
    en: "Your unit number never appears in public search, and while this is off it won't appear in share links either.",
  },
  allow_share_name: {
    ar: "اسمك لا يُعرض لأي متلقٍّ للرابط عند الإيقاف.",
    en: "Your name is hidden from anyone who opens a share link while this is off.",
  },
  allow_share_instructions: {
    ar: "تعليمات الوصول الخاصة (الجرس، الدرج، الباب) تبقى لك وحدك عند الإيقاف.",
    en: "Private access instructions (the bell, the stairs, the door) stay visible only to you while this is off.",
  },
};

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "مركز الخصوصية — سيرياسان" },
      {
        name: "description",
        content:
          "تحكّم كامل بما يُشارَك من عنوانك: الهاتف، رقم الشقة، الطابق، الاسم، تعليمات الوصول، ومدة صلاحية كل رابط، مع إلغاء فوري لأي مشاركة.",
      },
      { property: "og:title", content: "مركز الخصوصية — سيرياسان" },
      {
        property: "og:description",
        content: "عنوانك السكني خاص افتراضياً. أنت تقرر ما يُشارَك، ومع من، ولكم من الوقت.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setReady(true);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <header className="mb-4">
          <h1 className="flex items-center gap-2 text-lg font-black">
            <ShieldCheck className="size-5 text-primary" /> {t({ ar: "مركز الخصوصية", en: "Privacy Centre" })}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t({
              ar: "العناوين السكنية خاصة افتراضياً ولا تظهر في البحث العام ولا في الواجهة البرمجية. لا يُعرض اسمك ولا رقم شقتك ولا هاتفك ولا ملاحظاتك الخاصة لأحد إلا إذا أنشأت أنت رابط مشاركة يتضمنها.",
              en: "Residential addresses are private by default and never appear in public search or the API. Your name, unit number, phone number, and private notes are never shown to anyone unless you create a share link that includes them.",
            })}
          </p>
        </header>

        {!ready ? null : !signedIn ? (
          <section className={card}>
            <p className="text-sm">{t({ ar: "سجّل الدخول لإدارة خصوصيتك وروابط المشاركة.", en: "Sign in to manage your privacy settings and share links." })}</p>
            <Link
              to="/auth"
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              {t({ ar: "تسجيل الدخول", en: "Sign in" })}
            </Link>
          </section>
        ) : (
          <div className="flex flex-col gap-4">
            <PreferencesCard />
            <SharesCard />
            <section className={card}>
              <h2 className="text-sm font-bold">{t({ ar: "كيف تُفصل بياناتك", en: "How your data is separated" })}</h2>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>
                  •{" "}
                  {t({
                    ar: "بيانات الأماكن العامة: مستشفيات ومدارس ودوائر — مرئية للجميع.",
                    en: "Public place data: hospitals, schools, and government offices — visible to everyone.",
                  })}
                </li>
                <li>
                  •{" "}
                  {t({
                    ar: "بيانات الأعمال: ما ينشره صاحب العمل عن فرعه فقط.",
                    en: "Business data: only what a business owner publishes about their own branch.",
                  })}
                </li>
                <li>
                  •{" "}
                  {t({
                    ar: "العناوين الخاصة: لك وحدك، محميّة على مستوى قاعدة البيانات.",
                    en: "Private addresses: yours alone, protected at the database level.",
                  })}
                </li>
                <li>
                  •{" "}
                  {t({
                    ar: "المشارَك مؤقتاً: حقول محددة تنتهي صلاحيتها تلقائياً ويمكنك إلغاؤها فوراً.",
                    en: "Temporarily shared data: specific fields that expire automatically, and you can revoke them instantly.",
                  })}
                </li>
              </ul>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function PreferencesCard() {
  const queryClient = useQueryClient();
  const fetchPrefs = useServerFn(myPrivacy);
  const save = useServerFn(updatePrivacy);
  const query = useQuery({ queryKey: ["privacy-prefs"], queryFn: () => fetchPrefs() });
  const prefs = query.data ?? DEFAULT_PRIVACY;
  const { t } = useI18n();

  const mutation = useMutation({
    mutationFn: (patch: Partial<PrivacyPreferences>) => save({ data: patch }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["privacy-prefs"] });
      toast.success(t({ ar: "تم حفظ تفضيلات الخصوصية", en: "Privacy preferences saved" }));
    },
    onError: () => toast.error(t({ ar: "تعذر الحفظ", en: "Couldn't save changes" })),
  });

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Lock className="size-4 text-primary" /> {t({ ar: "ما الذي يُسمح بمشاركته", en: "What's allowed to be shared" })}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t({
          ar: "ما توقفه هنا لا يُضاف إلى أي رابط مشاركة جديد، حتى لو طُلب ذلك.",
          en: "Anything you turn off here is left out of every new share link, even if it's requested.",
        })}
      </p>

      <div className="mt-3 grid gap-2">
        {TOGGLES.map((key) => (
          <label key={key} className={toggleRow}>
            <span className="flex-1">
              <span className="font-bold">{t(PRIVACY_LABELS[key])}</span>
              {HELP[key] ? (
                <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                  {t(HELP[key]!)}
                </span>
              ) : null}
            </span>
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-primary)]"
              checked={Boolean(prefs[key])}
              disabled={mutation.isPending}
              onChange={(e) => mutation.mutate({ [key]: e.target.checked })}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField
          label={t(PRIVACY_LABELS.default_share_hours)}
          value={prefs.default_share_hours}
          onSave={(v) => mutation.mutate({ default_share_hours: v })}
        />
        <NumberField
          label={t(PRIVACY_LABELS.max_share_hours)}
          value={prefs.max_share_hours}
          onSave={(v) => mutation.mutate({ max_share_hours: v })}
        />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="size-3.5" />{" "}
        {t({ ar: "أي رابط يتجاوز الحد الأقصى يُقصَّر تلقائياً إليه.", en: "Any link that exceeds the maximum is automatically shortened to it." })}
      </p>
    </section>
  );
}

function NumberField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
      <input
        type="number"
        min={1}
        max={8760}
        dir="ltr"
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = Number.parseInt(draft, 10);
          if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 8760 && parsed !== value) {
            onSave(parsed);
          } else {
            setDraft(String(value));
          }
        }}
      />
    </label>
  );
}

function SharesCard() {
  const queryClient = useQueryClient();
  const fetchActivity = useServerFn(mySharingActivity);
  const revokeOne = useServerFn(revokeShare);
  const revokeAll = useServerFn(revokeAllShares);
  const query = useQuery({ queryKey: ["privacy-shares"], queryFn: () => fetchActivity() });
  const data = query.data;
  const { t, lang, date } = useI18n();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["privacy-shares"] });

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Link2Off className="size-4 text-primary" /> {t({ ar: "روابط المشاركة", en: "Share links" })}
        </h2>
        {data && data.active_count > 0 ? (
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-destructive"
            onClick={async () => {
              await revokeAll();
              await refresh();
              toast.success(t({ ar: "تم إلغاء جميع الروابط النشطة", en: "All active links revoked" }));
            }}
          >
            {t({ ar: "إلغاء كل الروابط النشطة", en: "Revoke all active links" })}
          </button>
        ) : null}
      </div>

      {data ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {lang === "ar"
            ? `${data.active_count} رابط نشط · ${data.total_uses} عملية فتح إجمالاً. لا نسجّل هوية من يفتح الرابط.`
            : `${data.active_count} active link${data.active_count === 1 ? "" : "s"} · ${data.total_uses} total open${data.total_uses === 1 ? "" : "s"}. We never record who opens a link.`}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2">
        {(data?.links ?? []).map((link) => (
          <div key={`${link.kind}-${link.id}`} className="rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold">{link.token}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  link.active
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {link.revoked
                  ? t({ ar: "ملغى", en: "Revoked" })
                  : link.expired
                    ? t({ ar: "منتهي", en: "Expired" })
                    : link.active
                      ? t({ ar: "نشط", en: "Active" })
                      : t({ ar: "مستهلك", en: "Used up" })}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {link.kind === "address"
                ? t({ ar: "رابط عنوان مؤقت", en: "Temporary address link" })
                : t({ ar: "رابط مسار توصيل", en: "Delivery route link" })}
              {link.code ? ` · ${link.code}` : ""} ·{" "}
              {lang === "ar" ? `فُتح ${link.uses} مرة` : `opened ${link.uses} time${link.uses === 1 ? "" : "s"}`}
              {link.expires_at
                ? ` · ${t({ ar: "ينتهي", en: "expires" })} ${date(link.expires_at)}`
                : ""}
            </p>
            {link.shared_fields.length > 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t({ ar: "يشارك:", en: "Shares:" })} {link.shared_fields.join(lang === "ar" ? "، " : ", ")}
              </p>
            ) : null}
            {link.active ? (
              <button
                type="button"
                className="mt-2 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-destructive"
                onClick={async () => {
                  await revokeOne({ data: { id: link.id, kind: link.kind } });
                  await refresh();
                  toast.success(t({ ar: "تم إلغاء الرابط", en: "Link revoked" }));
                }}
              >
                {t({ ar: "إلغاء الآن", en: "Revoke now" })}
              </button>
            ) : null}
          </div>
        ))}
        {data && data.links.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t({ ar: "لم تنشئ أي رابط مشاركة بعد.", en: "You haven't created any share links yet." })}</p>
        ) : null}
      </div>
    </section>
  );
}
