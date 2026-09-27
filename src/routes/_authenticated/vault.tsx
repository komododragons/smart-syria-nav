import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Lock, Plus, Share2, Trash2, X } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { SHARE_FIELDS, type ShareField } from "@/lib/addresses.functions";
import { QUICK_PURPOSES, purposeLabel } from "@/lib/smart-address";
import { useI18n } from "@/lib/i18n";
import {
  VAULT_CATEGORIES,
  VAULT_CATEGORY_META,
  listVault,
  listVaultShares,
  removeVaultEntry,
  revokeVaultShare,
  saveToVault,
  shareFromVault,
  updateVaultEntry,
  type VaultCategory,
} from "@/lib/vault.functions";

const SHARE_FIELD_LABELS: Record<ShareField, { ar: string; en: string }> = {
  location: { ar: "الموقع", en: "Location" },
  building: { ar: "المبنى", en: "Building" },
  entrance: { ar: "المدخل", en: "Entrance" },
  floor: { ar: "الطابق", en: "Floor" },
  unit: { ar: "الشقة", en: "Unit" },
  instructions: { ar: "تعليمات الوصول", en: "Access instructions" },
  parking: { ar: "المواقف", en: "Parking" },
  phone: { ar: "الهاتف", en: "Phone" },
  name: { ar: "الاسم", en: "Name" },
};

const VAULT_CATEGORY_LABELS: Record<VaultCategory, { ar: string; en: string }> = {
  home: { ar: "المنزل", en: "Home" },
  work: { ar: "العمل", en: "Work" },
  parents: { ar: "بيت الأهل", en: "Family" },
  warehouse: { ar: "المستودع", en: "Warehouse" },
  office: { ar: "المكتب", en: "Office" },
  other: { ar: "أخرى", en: "Other" },
};

const EXPIRY_PRESETS = [
  { hours: 1, ar: "ساعة", en: "1 hour" },
  { hours: 24, ar: "٢٤ ساعة", en: "24 hours" },
  { hours: 168, ar: "٧ أيام", en: "7 days" },
];

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({
    meta: [
      { title: "خزنة العناوين الخاصة — سيرياسان" },
      {
        name: "description",
        content:
          "خزنة خاصة لعناوينك: المنزل، العمل، بيت الأهل، المستودع، المكتب. احفظها لنفسك وشارك فقط ما تختاره ولمدة تحددها.",
      },
      { property: "og:title", content: "خزنة العناوين الخاصة — سيرياسان" },
      {
        property: "og:description",
        content: "عناوينك الشخصية في مكان واحد خاص، مع مشاركة محدودة الحقول والمدة.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VaultPage,
});

function categoryLabel(t: (v: { ar: string; en: string }) => string, c: VaultCategory) {
  return t(VAULT_CATEGORY_LABELS[c] ?? { ar: c, en: c });
}

function VaultPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const { t, lang } = useI18n();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const listFn = useServerFn(listVault);
  const saveFn = useServerFn(saveToVault);
  const updateFn = useServerFn(updateVaultEntry);
  const removeFn = useServerFn(removeVaultEntry);
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["vault"],
    queryFn: () => listFn({ data: undefined as never }),
    enabled: authed === true,
  });

  const [filter, setFilter] = useState<VaultCategory | "all">("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ code: "", label: "", category: "home" as VaultCategory, note: "" });
  const [shareFor, setShareFor] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          code: form.code.trim(),
          label: form.label.trim() || categoryLabel(t, form.category),
          category: form.category,
          note: form.note.trim() || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success(t({ ar: "تمت الإضافة إلى الخزنة", en: "Added to the vault" }));
      setAdding(false);
      setForm({ code: "", label: "", category: "home", note: "" });
      await qc.invalidateQueries({ queryKey: ["vault"] });
    },
    onError: (e: Error) => toast.error(e.message || t({ ar: "تعذرت الإضافة", en: "Couldn't add the address" })),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; label?: string; category?: VaultCategory; note?: string | null }) =>
      updateFn({ data: vars }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["vault"] });
    },
    onError: () => toast.error(t({ ar: "تعذر التحديث", en: "Couldn't update the entry" })),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: async () => {
      toast.success(t({ ar: "تمت الإزالة من الخزنة", en: "Removed from the vault" }));
      await qc.invalidateQueries({ queryKey: ["vault"] });
    },
    onError: () => toast.error(t({ ar: "تعذرت الإزالة", en: "Couldn't remove the entry" })),
  });

  const entries = useMemo(
    () => (query.data ?? []).filter((e) => filter === "all" || e.category === filter),
    [query.data, filter],
  );

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <Lock className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">{t({ ar: "خزنة العناوين خاصة بك وحدك", en: "Your address vault is private to you" })}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t({ ar: "سجّل الدخول لعرض عناوينك المحفوظة.", en: "Sign in to view your saved addresses." })}</p>
          <Link
            to="/auth"
            className="mt-6 inline-block rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background"
          >
            {t({ ar: "تسجيل الدخول", en: "Sign in" })}
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t({ ar: "خزنة عناويني", en: "My address vault" })}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" />
              {t({ ar: "خاصة تماماً: لا تظهر في البحث ولا يراها أحد غيرك.", en: "Fully private: never appears in search, and no one else can see it." })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background"
          >
            <Plus className="size-4" />
            {t({ ar: "إضافة عنوان", en: "Add address" })}
          </button>
        </header>

        {adding ? (
          <section className="mt-4 rounded-xl border border-border bg-surface p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                {t({ ar: "الرمز الذكي", en: "Smart code" })}
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="SY-DAM-K7X4"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
                  dir="ltr"
                />
              </label>
              <label className="text-xs font-bold">
                {t({ ar: "الاسم المختصر", en: "Short name" })}
                <input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder={t({ ar: "منزلي", en: "My home" })}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {VAULT_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, category: c }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                    form.category === c
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {VAULT_CATEGORY_META[c].emoji} {categoryLabel(t, c)}
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs font-bold">
              {t({ ar: "ملاحظة خاصة (اختياري)", en: "Private note (optional)" })}
              <textarea
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!form.code.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="rounded-lg bg-foreground px-4 py-2 text-xs font-bold text-background disabled:opacity-50"
              >
                {saveMutation.isPending ? t({ ar: "جارٍ الحفظ…", en: "Saving…" }) : t({ ar: "حفظ في الخزنة", en: "Save to vault" })}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-bold"
              >
                {t({ ar: "إلغاء", en: "Cancel" })}
              </button>
            </div>
          </section>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <CategoryChip active={filter === "all"} onClick={() => setFilter("all")} label={t({ ar: "الكل", en: "All" })} emoji="🗂️" />
          {VAULT_CATEGORIES.map((c) => (
            <CategoryChip
              key={c}
              active={filter === c}
              onClick={() => setFilter(c)}
              label={categoryLabel(t, c)}
              emoji={VAULT_CATEGORY_META[c].emoji}
            />
          ))}
        </div>

        <section className="mt-4 space-y-3">
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">{t({ ar: "جارٍ تحميل الخزنة…", en: "Loading vault…" })}</p>
          ) : entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t({ ar: "لا توجد عناوين محفوظة بعد. أضف رمزاً ذكياً لتبدأ خزنتك الخاصة.", en: "No addresses saved yet. Add a smart code to start your private vault." })}
            </p>
          ) : (
            entries.map((entry) => (
              <article key={entry.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-base font-bold">
                      <span aria-hidden>{VAULT_CATEGORY_META[entry.category].emoji}</span>
                      {entry.label || categoryLabel(t, entry.category)}
                    </h2>
                    <p className="mt-1 font-mono text-xs text-muted-foreground" dir="ltr">
                      {entry.code ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {[entry.place, entry.neighborhood, entry.city].filter(Boolean).join(" — ") || "—"}
                    </p>
                    {entry.note ? (
                      <p className="mt-2 rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">
                        {entry.note}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={entry.category}
                      onChange={(e) =>
                        updateMutation.mutate({ id: entry.id, category: e.target.value as VaultCategory })
                      }
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                      aria-label={t({ ar: "التصنيف", en: "Category" })}
                    >
                      {VAULT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {VAULT_CATEGORY_META[c].emoji} {categoryLabel(t, c)}
                        </option>
                      ))}
                    </select>
                    {entry.code ? (
                      <button
                        type="button"
                        aria-label={t({ ar: "نسخ الرمز", en: "Copy code" })}
                        onClick={() => {
                          void navigator.clipboard.writeText(entry.code ?? "");
                          toast.success(t({ ar: "تم نسخ الرمز", en: "Code copied" }));
                        }}
                        className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground"
                      >
                        <Copy className="size-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={t({ ar: "حذف", en: "Delete" })}
                      onClick={() => removeMutation.mutate(entry.id)}
                      className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.code ? (
                    <Link
                      to="/a/$code"
                      params={{ code: entry.code }}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-bold"
                    >
                      {t({ ar: "فتح بطاقة العنوان", en: "Open address card" })}
                    </Link>
                  ) : null}
                  {entry.owned ? (
                    <button
                      type="button"
                      onClick={() => setShareFor(shareFor === entry.id ? null : entry.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background"
                    >
                      <Share2 className="size-3.5" />
                      {t({ ar: "مشاركة آمنة", en: "Secure share" })}
                    </button>
                  ) : (
                    <span className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
                      {t({ ar: "المشاركة الآمنة متاحة لمالك العنوان فقط", en: "Secure sharing is only available to the address owner" })}
                    </span>
                  )}
                </div>

                {shareFor === entry.id && entry.smart_address_id ? (
                  <SharePanel
                    entryId={entry.id}
                    smartAddressId={entry.smart_address_id}
                    onClose={() => setShareFor(null)}
                  />
                ) : null}
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
        active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
      }`}
    >
      {emoji} {label}
    </button>
  );
}

function SharePanel({
  entryId,
  smartAddressId,
  onClose,
}: {
  entryId: string;
  smartAddressId: string;
  onClose: () => void;
}) {
  const shareFn = useServerFn(shareFromVault);
  const listFn = useServerFn(listVaultShares);
  const revokeFn = useServerFn(revokeVaultShare);
  const qc = useQueryClient();
  const { t, lang, date } = useI18n();

  const [fields, setFields] = useState<ShareField[]>(["location", "building", "entrance", "instructions"]);
  const [purpose, setPurpose] = useState("parcel_delivery");
  const [hours, setHours] = useState(24);
  const [customHours, setCustomHours] = useState("");
  const [oneUse, setOneUse] = useState(true);
  const [contactPhone, setContactPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  const sharesQuery = useQuery({
    queryKey: ["vault-shares", smartAddressId],
    queryFn: () => listFn({ data: { smart_address_id: smartAddressId } }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      shareFn({
        data: {
          entry_id: entryId,
          purpose,
          hours: customHours ? Math.max(1, Number(customHours)) : hours,
          one_use: oneUse,
          shared_fields: fields,
          contact_phone: contactPhone.trim() || undefined,
          contact_name: contactName.trim() || undefined,
        },
      }),
    onSuccess: async (row) => {
      setIssued(row.token);
      toast.success(t({ ar: "تم إنشاء رابط مشاركة مؤقت", en: "Temporary share link created" }));
      await qc.invalidateQueries({ queryKey: ["vault-shares", smartAddressId] });
    },
    onError: (e: Error) => toast.error(e.message || t({ ar: "تعذر إنشاء الرابط", en: "Couldn't create the link" })),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: async () => {
      toast.success(t({ ar: "تم إبطال الرابط", en: "Link revoked" }));
      await qc.invalidateQueries({ queryKey: ["vault-shares", smartAddressId] });
    },
  });

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="mt-4 rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{t({ ar: "مشاركة محدودة — اختر ما يُعرض فقط", en: "Limited sharing — choose exactly what's shown" })}</h3>
        <button type="button" onClick={onClose} aria-label={t({ ar: "إغلاق", en: "Close" })} className="text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {SHARE_FIELDS.map((f) => {
          const on = fields.includes(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() =>
                setFields((prev) => (on ? prev.filter((x) => x !== f) : [...prev, f]))
              }
              className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
              }`}
            >
              {on ? "✓" : "✕"} {t(SHARE_FIELD_LABELS[f])}
            </button>
          );
        })}
      </div>

      {fields.includes("phone") ? (
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder={t({ ar: "رقم الهاتف الذي سيُعرض", en: "The phone number that will be shown" })}
          className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      ) : null}
      {fields.includes("name") ? (
        <input
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder={t({ ar: "الاسم الذي سيُعرض", en: "The name that will be shown" })}
          className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        />
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">
          {t({ ar: "الغرض", en: "Purpose" })}
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            {QUICK_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {purposeLabel(p, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold">
          {t({ ar: "مدة مخصصة (ساعات)", en: "Custom duration (hours)" })}
          <input
            value={customHours}
            onChange={(e) => setCustomHours(e.target.value.replace(/\D/g, ""))}
            placeholder={t({ ar: "مثال: 48", en: "e.g. 48" })}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {EXPIRY_PRESETS.map((p) => (
          <button
            key={p.hours}
            type="button"
            onClick={() => {
              setHours(p.hours);
              setCustomHours("");
            }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
              !customHours && hours === p.hours
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {t(p)}
          </button>
        ))}
        <label className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <input type="checkbox" checked={oneUse} onChange={(e) => setOneUse(e.target.checked)} />
          {t({ ar: "استخدام مرة واحدة", en: "Single use" })}
        </label>
      </div>

      <button
        type="button"
        disabled={fields.length === 0 || mutation.isPending}
        onClick={() => mutation.mutate()}
        className="mt-3 rounded-lg bg-foreground px-4 py-2 text-xs font-bold text-background disabled:opacity-50"
      >
        {mutation.isPending ? t({ ar: "جارٍ الإنشاء…", en: "Creating…" }) : t({ ar: "إنشاء رابط المشاركة", en: "Create share link" })}
      </button>

      {issued ? (
        <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="font-mono text-xs" dir="ltr">{`${origin}/t/${issued}`}</p>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(`${origin}/t/${issued}`);
              toast.success(t({ ar: "تم نسخ الرابط", en: "Link copied" }));
            }}
            className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
          >
            {t({ ar: "نسخ الرابط", en: "Copy link" })}
          </button>
        </div>
      ) : null}

      {(sharesQuery.data ?? []).length > 0 ? (
        <ul className="mt-4 space-y-2">
          {(sharesQuery.data ?? []).map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs"
            >
              <span className="font-mono" dir="ltr">
                {link.token}
              </span>
              <span className="text-muted-foreground">
                {link.revoked
                  ? t({ ar: "مُبطل", en: "Revoked" })
                  : `${t({ ar: "ينتهي", en: "expires" })} ${date(link.expires_at)}`}
              </span>
              <span className="text-muted-foreground">
                {(link.shared_fields ?? [])
                  .map((f) => t(SHARE_FIELD_LABELS[f as ShareField]) ?? f)
                  .join(lang === "ar" ? "، " : ", ")}
              </span>
              {!link.revoked ? (
                <button
                  type="button"
                  onClick={() => revokeMutation.mutate(link.id)}
                  className="rounded-lg border border-border px-2 py-1 font-bold"
                >
                  {t({ ar: "إبطال", en: "Revoke" })}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
