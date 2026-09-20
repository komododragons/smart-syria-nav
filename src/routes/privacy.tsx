import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Link2Off, Lock, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PRIVACY,
  PRIVACY_LABELS_AR,
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

const HELP_AR: Partial<Record<keyof PrivacyPreferences, string>> = {
  allow_share_phone: "لا يُدرج رقمك في أي رابط مشاركة عند الإيقاف.",
  allow_share_unit: "رقم الشقة لا يظهر أبداً في البحث العام، وعند الإيقاف لا يظهر حتى في الروابط.",
  allow_share_name: "اسمك لا يُعرض لأي متلقٍّ للرابط عند الإيقاف.",
  allow_share_instructions: "تعليمات الوصول الخاصة (الجرس، الدرج، الباب) تبقى لك وحدك عند الإيقاف.",
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setReady(true);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <header className="mb-4">
          <h1 className="flex items-center gap-2 text-lg font-black">
            <ShieldCheck className="size-5 text-primary" /> مركز الخصوصية
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            العناوين السكنية خاصة افتراضياً ولا تظهر في البحث العام ولا في الواجهة البرمجية. لا
            يُعرض اسمك ولا رقم شقتك ولا هاتفك ولا ملاحظاتك الخاصة لأحد إلا إذا أنشأت أنت رابط
            مشاركة يتضمنها.
          </p>
        </header>

        {!ready ? null : !signedIn ? (
          <section className={card}>
            <p className="text-sm">سجّل الدخول لإدارة خصوصيتك وروابط المشاركة.</p>
            <Link
              to="/auth"
              className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
            >
              تسجيل الدخول
            </Link>
          </section>
        ) : (
          <div className="flex flex-col gap-4">
            <PreferencesCard />
            <SharesCard />
            <section className={card}>
              <h2 className="text-sm font-bold">كيف تُفصل بياناتك</h2>
              <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                <li>• بيانات الأماكن العامة: مستشفيات ومدارس ودوائر — مرئية للجميع.</li>
                <li>• بيانات الأعمال: ما ينشره صاحب العمل عن فرعه فقط.</li>
                <li>• العناوين الخاصة: لك وحدك، محميّة على مستوى قاعدة البيانات.</li>
                <li>• المشارَك مؤقتاً: حقول محددة تنتهي صلاحيتها تلقائياً ويمكنك إلغاؤها فوراً.</li>
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

  const mutation = useMutation({
    mutationFn: (patch: Partial<PrivacyPreferences>) => save({ data: patch }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["privacy-prefs"] });
      toast.success("تم حفظ تفضيلات الخصوصية");
    },
    onError: () => toast.error("تعذر الحفظ"),
  });

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Lock className="size-4 text-primary" /> ما الذي يُسمح بمشاركته
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        ما توقفه هنا لا يُضاف إلى أي رابط مشاركة جديد، حتى لو طُلب ذلك.
      </p>

      <div className="mt-3 grid gap-2">
        {TOGGLES.map((key) => (
          <label key={key} className={toggleRow}>
            <span className="flex-1">
              <span className="font-bold">{PRIVACY_LABELS_AR[key]}</span>
              {HELP_AR[key] ? (
                <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                  {HELP_AR[key]}
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
          label={PRIVACY_LABELS_AR.default_share_hours}
          value={prefs.default_share_hours}
          onSave={(v) => mutation.mutate({ default_share_hours: v })}
        />
        <NumberField
          label={PRIVACY_LABELS_AR.max_share_hours}
          value={prefs.max_share_hours}
          onSave={(v) => mutation.mutate({ max_share_hours: v })}
        />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Clock className="size-3.5" /> أي رابط يتجاوز الحد الأقصى يُقصَّر تلقائياً إليه.
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["privacy-shares"] });

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <Link2Off className="size-4 text-primary" /> روابط المشاركة
        </h2>
        {data && data.active_count > 0 ? (
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-destructive"
            onClick={async () => {
              await revokeAll();
              await refresh();
              toast.success("تم إلغاء جميع الروابط النشطة");
            }}
          >
            إلغاء كل الروابط النشطة
          </button>
        ) : null}
      </div>

      {data ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {data.active_count} رابط نشط · {data.total_uses} عملية فتح إجمالاً. لا نسجّل هوية من يفتح
          الرابط.
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
                {link.revoked ? "ملغى" : link.expired ? "منتهي" : link.active ? "نشط" : "مستهلك"}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {link.kind === "address" ? "رابط عنوان مؤقت" : "رابط مسار توصيل"}
              {link.code ? ` · ${link.code}` : ""} · فُتح {link.uses} مرة
              {link.expires_at
                ? ` · ينتهي ${new Date(link.expires_at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}`
                : ""}
            </p>
            {link.shared_fields.length > 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                يشارك: {link.shared_fields.join("، ")}
              </p>
            ) : null}
            {link.active ? (
              <button
                type="button"
                className="mt-2 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-destructive"
                onClick={async () => {
                  await revokeOne({ data: { id: link.id, kind: link.kind } });
                  await refresh();
                  toast.success("تم إلغاء الرابط");
                }}
              >
                إلغاء الآن
              </button>
            ) : null}
          </div>
        ))}
        {data && data.links.length === 0 ? (
          <p className="text-xs text-muted-foreground">لم تنشئ أي رابط مشاركة بعد.</p>
        ) : null}
      </div>
    </section>
  );
}
