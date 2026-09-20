import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BadgeCheck, FileUp, Loader2, ShieldCheck, Trash2 } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { getBusinessProfile } from "@/lib/addresses.functions";
import { CLAIM_METHODS, submitClaim } from "@/lib/claims.functions";
import { useI18n, type Bilingual } from "@/lib/i18n";

export const Route = createFileRoute("/claim/$id")({
  head: () => ({
    meta: [
      { title: "المطالبة بملكية عنوان | شبكة العنوان الذكي السورية" },
      {
        name: "description",
        content:
          "أثبت ملكيتك أو إدارتك لعمل تجاري على شبكة العنوان الذكي، وأرفق وثائق التحقق لمراجعتها من فريق التوثيق.",
      },
      { property: "og:title", content: "المطالبة بملكية عنوان — سيرياسان" },
      {
        property: "og:description",
        content: "طلب توثيق ملكية عمل تجاري مع مراجعة بشرية وسجل تدقيق كامل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClaimPage,
});

type MethodKey = keyof typeof CLAIM_METHODS;

const CLAIM_METHOD_LABELS: Record<MethodKey, Bilingual> = {
  document: { ar: "وثيقة رسمية (سجل تجاري، عقد، فاتورة)", en: "Official document (business registration, contract, invoice)" },
  phone: { ar: "رقم الهاتف المعلن للعمل", en: "The business's published phone number" },
  email: { ar: "البريد الإلكتروني الرسمي", en: "Official business email" },
  on_site: { ar: "تحقق ميداني من الموقع", en: "On-site field verification" },
  other: { ar: "طريقة أخرى", en: "Another method" },
};

function ClaimPage() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getBusinessProfile);
  const submit = useServerFn(submitClaim);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<MethodKey>("document");
  const [evidence, setEvidence] = useState("");
  const [files, setFiles] = useState<{ path: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<null | { conflict: boolean }>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(Boolean(data.session));
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  const profile = useQuery({
    queryKey: ["business", id],
    queryFn: () => fetchProfile({ data: { id } }),
  });
  const biz = profile.data?.status === "ok" ? profile.data.business : null;

  const handleUpload = async (list: FileList | null) => {
    if (!list || !userId) return;
    const picked = Array.from(list).slice(0, 8 - files.length);
    setUploading(true);
    try {
      for (const file of picked) {
        const path = `${userId}/${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("claim-evidence").upload(path, file);
        if (error) throw error;
        setFiles((prev) => [...prev, { path, name: file.name }]);
      }
      toast.success(t({ ar: "تم رفع الوثيقة", en: "Document uploaded" }));
    } catch {
      toast.error(t({ ar: "تعذّر رفع الملف — الحد الأقصى 10 ميغابايت لكل ملف", en: "Couldn't upload the file — 10 MB maximum per file" }));
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (path: string) => {
    await supabase.storage.from("claim-evidence").remove([path]);
    setFiles((prev) => prev.filter((f) => f.path !== path));
  };

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          business_id: id,
          claimant_name: name.trim(),
          claimant_role: role.trim(),
          contact_phone: phone.trim(),
          contact_email: email.trim(),
          claim_method: method,
          evidence: evidence.trim() || undefined,
          evidence_urls: files.map((f) => f.path),
        },
      }),
    onSuccess: (res) => {
      if (res.status === "submitted") {
        setDone({ conflict: res.conflict });
        toast.success(t({ ar: "أُرسل طلب المطالبة إلى فريق التوثيق", en: "Your claim request was sent to our verification team" }));
      } else if (res.status === "already_pending") {
        toast.info(t({ ar: "لديك طلب معلّق لهذا العمل", en: "You already have a pending request for this business" }));
      } else if (res.status === "already_owner") {
        toast.info(t({ ar: "أنت المالك الموثق لهذا العمل", en: "You are already the verified owner of this business" }));
      } else {
        toast.error(t({ ar: "العمل غير موجود", en: "This business could not be found" }));
      }
    },
    onError: () => toast.error(t({ ar: "تعذّر إرسال الطلب", en: "Couldn't submit the request" })),
  });

  const valid = name.trim().length > 1 && role.trim().length > 1 && phone.trim().length > 4;

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground" dir="rtl">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign-in required" })}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t({ ar: "سجّل الدخول لتتمكن من المطالبة بملكية هذا العنوان.", en: "Sign in to claim ownership of this address." })}
          </p>
          <Link to="/auth" className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
            {t({ ar: "تسجيل الدخول", en: "Sign in" })}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t({ ar: "المطالبة بملكية هذا العنوان", en: "Claim ownership of this address" })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {biz
            ? `${biz.name_ar}${biz.category ? ` — ${biz.category}` : ""}`
            : t({ ar: "جارٍ تحميل بيانات العمل…", en: "Loading business details…" })}
        </p>

        {done ? (
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-primary">
              <BadgeCheck className="h-5 w-5" />
              <span className="font-semibold">{t({ ar: "تم استلام طلبك", en: "Your request has been received" })}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t({
                ar: "سيراجع فريق التوثيق الوثائق ويتواصل معك عبر الرقم الذي أدخلته. يمكنك متابعة حالة الطلب من صفحة عناويني.",
                en: "Our verification team will review the documents and contact you at the number you provided. You can track the request's status from My Addresses.",
              })}
            </p>
            {done.conflict ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                {t({
                  ar: "يوجد طلب آخر معلّق لنفس العمل — ستُراجَع الطلبات المتعارضة معاً.",
                  en: "There is another pending request for this business — conflicting requests will be reviewed together.",
                })}
              </p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <Link to="/my-addresses" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
                {t({ ar: "متابعة الطلبات", en: "Track requests" })}
              </Link>
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-sm"
                onClick={() => navigate({ to: "/business/$id", params: { id } })}
              >
                {t({ ar: "عودة لملف العمل", en: "Back to business profile" })}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) mutation.mutate();
            }}
          >
            <Field label={t({ ar: "الاسم الكامل للمطالِب", en: "Claimant's full name" })}>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label={t({ ar: "صفتك (مالك، مدير، مفوّض…)", en: "Your role (owner, manager, authorized agent…)" })}>
              <input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t({ ar: "رقم للتواصل", en: "Contact number" })}>
                <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </Field>
              <Field label={t({ ar: "بريد إلكتروني (اختياري)", en: "Email (optional)" })}>
                <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            <Field label={t({ ar: "طريقة إثبات الملكية", en: "Proof of ownership method" })}>
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as MethodKey)}>
                {Object.keys(CLAIM_METHODS).map((key) => (
                  <option key={key} value={key}>
                    {t(CLAIM_METHOD_LABELS[key as MethodKey])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t({ ar: "تفاصيل إضافية", en: "Additional details" })}>
              <textarea
                className={`${inputCls} min-h-24`}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder={t({
                  ar: "مثال: رقم السجل التجاري، اسم المالك في الترخيص، أو أي معلومة تساعد المراجع.",
                  en: "Example: business registration number, owner's name on the license, or any detail that helps the reviewer.",
                })}
              />
            </Field>

            <div>
              <span className="text-sm font-medium">
                {t({ ar: "وثائق التحقق (حتى 8 ملفات، 10 م.ب للملف)", en: "Verification documents (up to 8 files, 10 MB each)" })}
              </span>
              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                {t({ ar: "رفع صورة أو ملف PDF", en: "Upload an image or PDF file" })}
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  disabled={uploading || files.length >= 8}
                  onChange={(e) => handleUpload(e.target.files)}
                />
              </label>
              {files.length ? (
                <ul className="mt-2 space-y-1">
                  {files.map((f) => (
                    <li key={f.path} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
                      <span className="truncate">{f.name}</span>
                      <button type="button" onClick={() => removeFile(f.path)} aria-label={t({ ar: "حذف", en: "Remove" })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {t({
                  ar: "الوثائق خاصة تماماً ولا تظهر إلا لفريق المراجعة، ولا تُنشر على الملف العام.",
                  en: "Documents are completely private, visible only to our review team, and are never published on the public profile.",
                })}
              </p>
            </div>

            <button
              type="submit"
              disabled={!valid || mutation.isPending}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {mutation.isPending
                ? t({ ar: "جارٍ الإرسال…", en: "Submitting…" })
                : t({ ar: "إرسال طلب المطالبة", en: "Submit claim request" })}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
