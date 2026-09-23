import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  BarChart3,
  Building2,
  Code2,
  FileSpreadsheet,
  KeyRound,
  LayoutTemplate,
  MapPinned,
  Pencil,
  Plus,
  QrCode,
  Settings,
  Store,
  Trash2,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PLACE_CATEGORIES } from "@/lib/place-categories";
import { myEntitlements } from "@/lib/plans.functions";
import { ADDRESS_CLASSIFICATION_LABELS, type AddressClassification } from "@/lib/address-classification";
import { LIMIT_LABELS_AR, PLANS, formatLimit, type LimitKey } from "@/lib/plans";
import { BulkImportTab } from "@/components/BulkImportTab";
import { CadastralMap } from "@/components/CadastralMap";
import { QrCardLazy as QrCard } from "@/components/QrCardLazy";
import { supabase } from "@/integrations/supabase/client";
import {
  addOrgMember,
  attachBusinessToOrg,
  createOrgLocation,
  createOrganization,
  myOrganizations,
  myUnattachedBusinesses,
  orgAnalytics,
  orgLocations,
  orgMembers,
  ORG_ROLES,
  removeOrgMember,
  setLocationArchived,
  updateOrgLocation,
  updateOrgMemberRole,
  updateOrganization,
  type OrgRole,
} from "@/lib/orgs.functions";
import {
  createApiClient,
  createApiKey,
  listApiClients,
  revokeApiKey,
} from "@/lib/network.functions";
import { GOVERNORATES, verificationLabel, governorateLabel } from "@/lib/smart-address";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة إدارة الأعمال | شبكة العنوان الذكي السورية" },
      {
        name: "description",
        content:
          "أدر فروع شركتك على سيرياسان: المواقع، العناوين الذكية، التوثيق، رموز QR، لوحات العنوان، الواجهة البرمجية، الفريق والتحليلات.",
      },
      { property: "og:title", content: "لوحة إدارة الأعمال — سيرياسان" },
      {
        property: "og:description",
        content: "إدارة فرع واحد أو آلاف الفروع من مكان واحد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

type TabKey =
  | "locations"
  | "addresses"
  | "import"
  | "verification"
  | "qr"
  | "plates"
  | "api"
  | "team"
  | "analytics"
  | "settings";

const TABS: { key: TabKey; label: { ar: string; en: string }; icon: typeof Building2 }[] = [
  { key: "locations", label: { ar: "المواقع", en: "Locations" }, icon: Building2 },
  { key: "addresses", label: { ar: "العناوين", en: "Addresses" }, icon: MapPinned },
  { key: "import", label: { ar: "استيراد وتصدير", en: "Import & export" }, icon: FileSpreadsheet },
  { key: "verification", label: { ar: "التوثيق", en: "Verification" }, icon: BadgeCheck },
  { key: "qr", label: { ar: "رموز QR", en: "QR codes" }, icon: QrCode },
  { key: "plates", label: { ar: "لوحات العنوان", en: "Address plates" }, icon: LayoutTemplate },
  { key: "api", label: { ar: "الواجهة البرمجية", en: "API" }, icon: Code2 },
  { key: "team", label: { ar: "الفريق", en: "Team" }, icon: Users },
  { key: "analytics", label: { ar: "التحليلات", en: "Analytics" }, icon: BarChart3 },
  { key: "settings", label: { ar: "الإعدادات", en: "Settings" }, icon: Settings },
];

const card = "rounded-2xl border border-border bg-surface p-4 shadow-sm";
const input =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const primaryBtn =
  "flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground";
const ghostBtn =
  "flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function DashboardPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabKey>("locations");
  const [orgId, setOrgId] = useState<string | null>(null);

  const listOrgs = useServerFn(myOrganizations);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const orgs = useQuery({
    queryKey: ["my-orgs"],
    queryFn: () => listOrgs({ data: undefined as never }),
    enabled: authed === true,
  });

  useEffect(() => {
    if (!orgId && orgs.data?.length) setOrgId(orgs.data[0]!.organization.id);
  }, [orgs.data, orgId]);

  const active = orgs.data?.find((row) => row.organization.id === orgId) ?? null;
  const role = (active?.role ?? "viewer") as OrgRole;
  const canManage = role === "owner" || role === "admin" || role === "manager";
  const canAdmin = role === "owner" || role === "admin";

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "لوحة إدارة الأعمال", en: "Business dashboard" })}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t({ ar: "سجّل الدخول لإدارة فروع شركتك وعناوينها الذكية.", en: "Sign in to manage your company's branches and smart addresses." })}
          </p>
          <button
            type="button"
            className={`${primaryBtn} mx-auto mt-4`}
            onClick={() => void navigate({ to: "/auth", search: { redirect: "/dashboard" } })}
          >
            {t({ ar: "تسجيل الدخول", en: "Sign in" })}
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Store className="size-5 text-primary" />
              {t({ ar: "لوحة إدارة الأعمال", en: "Business dashboard" })}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t({ ar: "فرع واحد أو آلاف الفروع — إدارة موحّدة للعناوين الذكية.", en: "One branch or thousands — unified management for your smart addresses." })}
            </p>
          </div>
          {orgs.data?.length ? (
            <select
              className={`${input} max-w-60`}
              value={orgId ?? ""}
              onChange={(event) => setOrgId(event.target.value)}
            >
              {orgs.data.map((row) => (
                <option key={row.organization.id} value={row.organization.id}>
                  {row.organization.name_ar} — {ORG_ROLES[row.role]}
                </option>
              ))}
            </select>
          ) : null}
        </header>

        {orgs.isPending ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p>
        ) : null}

        {orgs.data && orgs.data.length === 0 ? <CreateOrgCard /> : null}

        {active && orgId ? (
          <>
            <nav className="flex gap-2 overflow-x-auto pb-1">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
                    tab === key ? "bg-primary text-primary-foreground" : "border border-border"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {t(label)}
                </button>
              ))}
            </nav>

            {tab === "locations" ? <LocationsTab orgId={orgId} canManage={canManage} canAdmin={canAdmin} /> : null}
            {tab === "addresses" ? <AddressesTab orgId={orgId} /> : null}
            {tab === "import" ? <BulkImportTab orgId={orgId} canManage={canManage} /> : null}
            {tab === "verification" ? <VerificationTab orgId={orgId} /> : null}
            {tab === "qr" ? <CodesTab orgId={orgId} plate={false} /> : null}
            {tab === "plates" ? <CodesTab orgId={orgId} plate /> : null}
            {tab === "api" ? <ApiTab /> : null}
            {tab === "team" ? <TeamTab orgId={orgId} canAdmin={canAdmin} /> : null}
            {tab === "analytics" ? <AnalyticsTab orgId={orgId} /> : null}
            {tab === "settings" ? (
              <SettingsTab organization={active.organization} canAdmin={canAdmin} />
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

function CreateOrgCard() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const create = useServerFn(createOrganization);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className={card}>
      <h2 className="text-sm font-bold">{t({ ar: "أنشئ حساب شركة", en: "Create a company account" })}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t({ ar: "الحساب يجمع كل فروعك تحت إدارة واحدة مع صلاحيات فريق.", en: "One account brings all your branches under unified management with team roles." })}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={t({ ar: "اسم الشركة (عربي)", en: "Company name (Arabic)" })}>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Company name (English)">
          <input className={input} dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </Field>
      </div>
      <button
        type="button"
        disabled={busy || name.trim().length < 2}
        className={`${primaryBtn} mt-3 disabled:opacity-50`}
        onClick={async () => {
          setBusy(true);
          try {
            await create({ data: { name_ar: name.trim(), name_en: nameEn.trim() || null } });
            await queryClient.invalidateQueries({ queryKey: ["my-orgs"] });
            toast.success(t({ ar: "تم إنشاء حساب الشركة", en: "Company account created" }));
          } catch {
            toast.error(t({ ar: "تعذر إنشاء الحساب", en: "Couldn't create the account" }));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Plus className="size-3.5" /> {t({ ar: "إنشاء", en: "Create" })}
      </button>
    </section>
  );
}

function useLocations(orgId: string, includeArchived = false) {
  const fetchLocations = useServerFn(orgLocations);
  return useQuery({
    queryKey: ["org-locations", orgId, includeArchived],
    queryFn: () => fetchLocations({ data: { organization_id: orgId, include_archived: includeArchived } }),
  });
}

type LocationForm = {
  business_id?: string;
  node_id?: string;
  name_ar: string;
  branch_label: string;
  category: string;
  place_category: string;
  phone: string;
  opening_hours: string;
  governorate_code: string;
  city: string;
  neighborhood: string;
  street: string;
  landmark: string;
  building_number: string;
  latitude: number;
  longitude: number;
  entrance_name: string;
  entrance_instructions: string;
  is_published: boolean;
  address_classification: Exclude<AddressClassification, "private_residence" | "building_residential_complex">;
};

const emptyForm: LocationForm = {
  name_ar: "",
  branch_label: "",
  category: "",
  place_category: "",
  phone: "",
  opening_hours: "",
  governorate_code: "DAM",
  city: "",
  neighborhood: "",
  street: "",
  landmark: "",
  building_number: "",
  latitude: 33.5138,
  longitude: 36.2765,
  entrance_name: "",
  entrance_instructions: "",
  is_published: true,
  address_classification: "business_shop",
};

function LocationsTab({
  orgId,
  canManage,
  canAdmin,
}: {
  orgId: string;
  canManage: boolean;
  canAdmin: boolean;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const locations = useLocations(orgId, includeArchived);
  const create = useServerFn(createOrgLocation);
  const update = useServerFn(updateOrgLocation);
  const archive = useServerFn(setLocationArchived);
  const attach = useServerFn(attachBusinessToOrg);
  const listLoose = useServerFn(myUnattachedBusinesses);

  const [form, setForm] = useState<LocationForm | null>(null);
  const [busy, setBusy] = useState(false);

  const loose = useQuery({
    queryKey: ["unattached-businesses"],
    queryFn: () => listLoose({ data: undefined as never }),
    enabled: canAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["org-locations", orgId] });

  const save = async () => {
    if (!form) return;
    const governorate = GOVERNORATES.find((g) => g.code === form.governorate_code)?.ar ?? "دمشق";
    setBusy(true);
    try {
      const payload = {
        organization_id: orgId,
        name_ar: form.name_ar.trim(),
        name_en: null,
        branch_label: form.branch_label.trim() || null,
        category: form.category.trim() || null,
        place_category: form.place_category || null,
        phone: form.phone.trim() || null,
        website: null,
        opening_hours: form.opening_hours.trim() || null,
        logo_url: null,
        governorate,
        governorate_code: form.governorate_code,
        city: form.city.trim() || null,
        district: null,
        neighborhood: form.neighborhood.trim() || null,
        street: form.street.trim() || null,
        landmark: form.landmark.trim() || null,
        building_number: form.building_number.trim() || null,
        parking_info: null,
        loading_info: null,
        latitude: form.latitude,
        longitude: form.longitude,
        entrance_name: form.entrance_name.trim() || null,
        entrance_instructions: form.entrance_instructions.trim() || null,
        is_published: form.is_published,
        address_classification: form.address_classification,
      };
      if (form.business_id && form.node_id) {
        await update({ data: { ...payload, business_id: form.business_id, node_id: form.node_id } });
        toast.success(t({ ar: "تم تحديث الموقع", en: "Location updated" }));
      } else {
        const res = await create({ data: payload });
        toast.success(t({ ar: `تم إنشاء الموقع — ${res.code}`, en: `Location created — ${res.code}` }));
      }
      setForm(null);
      await refresh();
    } catch {
      toast.error(t({ ar: "تعذر حفظ الموقع", en: "Couldn't save the location" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs font-bold">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          {t({ ar: "إظهار المؤرشفة", en: "Show archived" })}
        </label>
        {canManage ? (
          <button type="button" className={primaryBtn} onClick={() => setForm({ ...emptyForm })}>
            <Plus className="size-3.5" /> {t({ ar: "موقع جديد", en: "New location" })}
          </button>
        ) : null}
      </div>

      {canAdmin && loose.data?.length ? (
        <section className={card}>
          <h3 className="text-sm font-bold">{t({ ar: "مواقع تملكها ولم تُضف إلى الشركة", en: "Locations you own that aren't attached to this company yet" })}</h3>
          <div className="mt-2 flex flex-col gap-2">
            {loose.data.map((biz) => (
              <div key={biz.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="text-sm">
                  {biz.name_ar}
                  {biz.code ? <span className="ms-2 font-mono text-xs text-muted-foreground" dir="ltr">{biz.code}</span> : null}
                </span>
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={async () => {
                    try {
                      await attach({ data: { organization_id: orgId, business_id: biz.id } });
                      await Promise.all([refresh(), loose.refetch()]);
                      toast.success(t({ ar: "تمت إضافة الموقع إلى الشركة", en: "Location attached to the company" }));
                    } catch {
                      toast.error(t({ ar: "تعذرت الإضافة", en: "Couldn't attach it" }));
                    }
                  }}
                >
                  {t({ ar: "ضمّ إلى الشركة", en: "Attach to company" })}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {form ? (
        <section className={card}>
          <h3 className="text-sm font-bold">{form.business_id ? t({ ar: "تعديل موقع", en: "Edit location" }) : t({ ar: "موقع جديد", en: "New location" })}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label={t({ ar: "اسم الموقع", en: "Location name" })}>
              <input className={input} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </Field>
            <Field label={t({ ar: "نوع الموقع", en: "Location type" })}>
              <select className={input} value={form.address_classification} onChange={(e) => setForm({ ...form, address_classification: e.target.value as LocationForm["address_classification"] })}>
                {(["business_shop", "office", "government_institution", "healthcare_facility", "hotel_accommodation", "warehouse_industrial"] as const).map((value) => <option key={value} value={value}>{t(ADDRESS_CLASSIFICATION_LABELS[value])}</option>)}
              </select>
            </Field>
            <Field label={t({ ar: "اسم الفرع", en: "Branch name" })}>
              <input className={input} value={form.branch_label} onChange={(e) => setForm({ ...form, branch_label: e.target.value })} />
            </Field>
            <Field label={t({ ar: "الفئة", en: "Category" })}>
              <input className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label={t({ ar: "تصنيف الدليل العام", en: "Public directory category" })}>
              <select
                className={input}
                value={form.place_category}
                onChange={(e) => setForm({ ...form, place_category: e.target.value })}
              >
                <option value="">{t({ ar: "بدون تصنيف عام", en: "No public category" })}</option>
                {PLACE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.emoji} {c.ar}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t({ ar: "الهاتف", en: "Phone" })}>
              <input className={input} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label={t({ ar: "ساعات العمل", en: "Opening hours" })}>
              <input className={input} value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} />
            </Field>
            <Field label={t({ ar: "المحافظة", en: "Governorate" })}>
              <select className={input} value={form.governorate_code} onChange={(e) => setForm({ ...form, governorate_code: e.target.value })}>
                {GOVERNORATES.map((g) => (
                  <option key={g.code} value={g.code}>{g.ar}</option>
                ))}
              </select>
            </Field>
            <Field label={t({ ar: "المدينة", en: "City" })}>
              <input className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label={t({ ar: "الحي", en: "Neighborhood" })}>
              <input className={input} value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
            </Field>
            <Field label={t({ ar: "الشارع", en: "Street" })}>
              <input className={input} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
            </Field>
            <Field label={t({ ar: "أقرب معلم", en: "Nearest landmark" })}>
              <input className={input} value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
            </Field>
            <Field label={t({ ar: "رقم المبنى", en: "Building number" })}>
              <input className={input} value={form.building_number} onChange={(e) => setForm({ ...form, building_number: e.target.value })} />
            </Field>
            <Field label={t({ ar: "اسم المدخل", en: "Entrance name" })}>
              <input className={input} value={form.entrance_name} onChange={(e) => setForm({ ...form, entrance_name: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t({ ar: "تعليمات الوصول إلى المدخل", en: "Entrance access instructions" })}>
                <textarea
                  className={`${input} min-h-20`}
                  value={form.entrance_instructions}
                  onChange={(e) => setForm({ ...form, entrance_instructions: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <p className="mt-3 text-xs font-bold text-muted-foreground">{t({ ar: "اختر الموقع على الخريطة", en: "Pick the location on the map" })}</p>
          <div className="mt-2">
            <CadastralMap
              center={{ latitude: form.latitude, longitude: form.longitude }}
              pins={[
                {
                  id: "draft",
                  latitude: form.latitude,
                  longitude: form.longitude,
                  label: form.name_ar || t({ ar: "الموقع", en: "Location" }),
                  tone: "draft",
                },
              ]}
              onPick={({ latitude, longitude }) => setForm({ ...form, latitude, longitude })}
            />
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">
            {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
          </p>

          <label className="mt-3 flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            />
            {t({ ar: "منشور للعامة", en: "Published publicly" })}
          </label>

          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy || form.name_ar.trim().length < 2} className={`${primaryBtn} disabled:opacity-50`} onClick={() => void save()}>
              {t({ ar: "حفظ", en: "Save" })}
            </button>
            <button type="button" className={ghostBtn} onClick={() => setForm(null)}>
              {t({ ar: "إلغاء", en: "Cancel" })}
            </button>
          </div>
        </section>
      ) : null}

      {locations.isPending ? <p className="text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p> : null}
      {locations.data && locations.data.locations.length === 0 ? (
        <p className={`${card} text-center text-sm text-muted-foreground`}>{t({ ar: "لا توجد مواقع بعد.", en: "No locations yet." })}</p>
      ) : null}

      {(locations.data?.locations ?? []).map((loc) => (
        <section key={loc.id} className={card}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">
                {loc.name_ar}
                {loc.branch_label ? <span className="text-muted-foreground"> — {loc.branch_label}</span> : null}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[loc.node?.neighborhood, loc.node?.city, loc.node?.governorate].filter(Boolean).join(" — ") || t({ ar: "بدون تفاصيل موقع", en: "No location details" })}
              </p>
              {loc.smart_code ? (
                <p className="mt-1 font-mono text-sm font-bold" dir="ltr">{loc.smart_code}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {loc.is_archived ? (
                <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">{t({ ar: "مؤرشف", en: "Archived" })}</span>
              ) : null}
              {canManage ? (
                <>
                  <button
                    type="button"
                    className={ghostBtn}
                    onClick={() =>
                      setForm({
                        business_id: loc.id,
                        node_id: loc.node_id ?? loc.node?.id ?? "",
                        name_ar: loc.name_ar,
                        branch_label: loc.branch_label ?? "",
                        category: loc.category ?? "",
                        place_category: loc.place_category ?? "",
                        phone: loc.phone ?? "",
                        opening_hours: loc.opening_hours ?? "",
                        governorate_code:
                          GOVERNORATES.find((g) => g.ar === loc.node?.governorate)?.code ?? "DAM",
                        city: loc.node?.city ?? "",
                        neighborhood: loc.node?.neighborhood ?? "",
                        street: loc.node?.street ?? "",
                        landmark: loc.node?.landmark ?? "",
                        building_number: loc.node?.building_number ?? "",
                        latitude: loc.node?.latitude ?? 33.5138,
                        longitude: loc.node?.longitude ?? 36.2765,
                        entrance_name: "",
                        entrance_instructions: "",
                        is_published: loc.is_published,
                        address_classification: (loc.smart_address?.address_classification ?? "business_shop") as LocationForm["address_classification"],
                      })
                    }
                  >
                    <Pencil className="size-3.5" /> {t({ ar: "تعديل", en: "Edit" })}
                  </button>
                  <button
                    type="button"
                    className={ghostBtn}
                    onClick={async () => {
                      try {
                        await archive({
                          data: { organization_id: orgId, business_id: loc.id, archived: !loc.is_archived },
                        });
                        await refresh();
                        toast.success(loc.is_archived ? t({ ar: "تمت الاستعادة", en: "Restored" }) : t({ ar: "تمت الأرشفة", en: "Archived" }));
                      } catch {
                        toast.error(t({ ar: "تعذر التنفيذ", en: "Couldn't complete that action" }));
                      }
                    }}
                  >
                    {loc.is_archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                    {loc.is_archived ? t({ ar: "استعادة", en: "Restore" }) : t({ ar: "أرشفة", en: "Archive" })}
                  </button>
                </>
              ) : null}
              {loc.smart_code ? (
                <Link to="/a/$code" params={{ code: loc.smart_code }} className={ghostBtn}>
                  {t({ ar: "فتح العنوان", en: "Open address" })}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function AddressesTab({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const locations = useLocations(orgId, true);
  const rows = locations.data?.locations ?? [];
  return (
    <section className={card}>
      <h2 className="text-sm font-bold">{t({ ar: `العناوين الذكية (${rows.length})`, en: `Smart addresses (${rows.length})` })}</h2>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((loc) => (
          <div key={loc.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-sm font-bold">{loc.branch_label || loc.name_ar}</span>
            <span className="font-mono text-xs" dir="ltr">{loc.smart_code ?? "—"}</span>
            <div className="ms-auto flex gap-2">
              {loc.smart_code ? (
                <>
                  <button
                    type="button"
                    className={ghostBtn}
                    onClick={() => {
                      void navigator.clipboard.writeText(loc.smart_code!);
                      toast.success(t({ ar: "تم نسخ الرمز", en: "Code copied" }));
                    }}
                  >
                    {t({ ar: "نسخ", en: "Copy" })}
                  </button>
                  <Link to="/a/$code" params={{ code: loc.smart_code }} className={ghostBtn}>
                    {t({ ar: "البطاقة", en: "Card" })}
                  </Link>
                  <Link to="/d/$code" params={{ code: loc.smart_code }} className={ghostBtn}>
                    {t({ ar: "وضع التوصيل", en: "Delivery mode" })}
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t({ ar: "لا توجد عناوين بعد.", en: "No addresses yet." })}</p> : null}
      </div>
    </section>
  );
}

function VerificationTab({ orgId }: { orgId: string }) {
  const { t, lang } = useI18n();
  const locations = useLocations(orgId, false);
  const rows = locations.data?.locations ?? [];
  return (
    <section className={card}>
      <h2 className="text-sm font-bold">{t({ ar: "حالة التوثيق", en: "Verification status" })}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t({ ar: "ارفع مستوى التوثيق عبر المطالبة بالملكية ومراجعة فريق سيرياسان.", en: "Raise your verification level by claiming ownership and passing review by the Syriasan team." })}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map((loc) => (
          <div key={loc.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-sm font-bold">{loc.branch_label || loc.name_ar}</span>
            <span
              className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                loc.verification_level === "unverified"
                  ? "bg-secondary text-muted-foreground"
                  : "bg-allow-surface text-allow"
              }`}
            >
              {verificationLabel(loc.verification_level, lang)}
            </span>
            {loc.node?.last_verified_at ? (
              <span className="text-[11px] text-muted-foreground">
                {t({ ar: "آخر توثيق", en: "Last verified" })}: {new Date(loc.node.last_verified_at).toLocaleDateString(lang === "ar" ? "ar-SY" : "en-GB")}
              </span>
            ) : null}
            <Link to="/claim/$id" params={{ id: loc.id }} className={`${ghostBtn} ms-auto`}>
              {t({ ar: "طلب توثيق الملكية", en: "Request ownership verification" })}
            </Link>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t({ ar: "لا توجد مواقع.", en: "No locations." })}</p> : null}
      </div>
    </section>
  );
}

function CodesTab({ orgId, plate }: { orgId: string; plate: boolean }) {
  const { t } = useI18n();
  const locations = useLocations(orgId, false);
  const rows = (locations.data?.locations ?? []).filter((loc) => loc.smart_code);
  const [open, setOpen] = useState<string | null>(null);
  const current = rows.find((loc) => loc.id === open) ?? null;

  return (
    <section className={card}>
      <h2 className="text-sm font-bold">{plate ? t({ ar: "لوحات العنوان", en: "Address plates" }) : t({ ar: "رموز QR", en: "QR codes" })}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {plate
          ? t({ ar: "اطبع لوحة بمقاسات A6 وA5 وA4 وملصق ولوحة باب وواجهة محل، مع شعار الشركة.", en: "Print a plate in A6, A5 and A4 sizes, plus a sticker, door sign, and storefront sign — with your company logo." })
          : t({ ar: "نزّل أو شارك رمز QR يفتح صفحة العنوان العامة للفرع.", en: "Download or share a QR code that opens the branch's public address page." })}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((loc) => (
          <button
            key={loc.id}
            type="button"
            onClick={() => setOpen(loc.id)}
            className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-3 text-start"
          >
            <span>
              <span className="block text-sm font-bold">{loc.branch_label || loc.name_ar}</span>
              <span className="block font-mono text-xs text-muted-foreground" dir="ltr">{loc.smart_code}</span>
            </span>
            {plate ? <LayoutTemplate className="size-4 text-primary" /> : <QrCode className="size-4 text-primary" />}
          </button>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t({ ar: "لا توجد عناوين بعد.", en: "No addresses yet." })}</p> : null}
      </div>

      {current?.smart_code ? (
        <QrCard
          url={
            typeof window === "undefined"
              ? `https://syriasan.com/a/${current.smart_code}`
              : `${window.location.origin}/a/${current.smart_code}`
          }
          code={current.smart_code}
          title={current.branch_label ? `${current.name_ar} — ${current.branch_label}` : current.name_ar}
          subtitle={[current.node?.neighborhood, current.node?.city].filter(Boolean).join(" — ")}
          logoUrl={current.logo_url}
          initialPlate={plate}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </section>
  );
}

function ApiTab() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const list = useServerFn(listApiClients);
  const createClient = useServerFn(createApiClient);
  const createKey = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);

  const clients = useQuery({
    queryKey: ["api-clients"],
    queryFn: () => list({ data: undefined as never }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["api-clients"] });

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <KeyRound className="size-4 text-primary" /> {t({ ar: "الواجهة البرمجية", en: "API" })}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t({ ar: "استخدم مفاتيح الوصول لحلّ رموز سيرياسان داخل أنظمتك. راجع", en: "Use access keys to resolve Syriasan codes inside your own systems. See the" })}
        <Link to="/developers" className="mx-1 text-primary">{t({ ar: "دليل المطورين", en: "developer guide" })}</Link>.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input className={`${input} max-w-60`} placeholder={t({ ar: "اسم التطبيق", en: "App name" })} value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          disabled={name.trim().length < 2}
          className={`${primaryBtn} disabled:opacity-50`}
          onClick={async () => {
            try {
              await createClient({ data: { name: name.trim(), environment: "live" } });
              setName("");
              await refresh();
              toast.success(t({ ar: "تم إنشاء التطبيق", en: "App created" }));
            } catch {
              toast.error(t({ ar: "تعذر الإنشاء", en: "Couldn't create it" }));
            }
          }}
        >
          <Plus className="size-3.5" /> {t({ ar: "تطبيق جديد", en: "New app" })}
        </button>
      </div>

      {fresh ? (
        <p className="mt-3 break-all rounded-lg border border-primary/40 bg-primary/5 p-3 font-mono text-xs" dir="ltr">
          {fresh}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {(clients.data?.clients ?? []).map((client) => (
          <div key={client.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold">{client.name}</span>
              <button
                type="button"
                className={ghostBtn}
                onClick={async () => {
                  try {
                    const res = await createKey({ data: { client_id: client.id } });
                    setFresh(res.key);
                    await refresh();
                  } catch {
                    toast.error(t({ ar: "تعذر إنشاء المفتاح", en: "Couldn't create the key" }));
                  }
                }}
              >
                {t({ ar: "مفتاح جديد", en: "New key" })}
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {(clients.data?.keys ?? [])
                .filter((key) => key.client_id === client.id)
                .map((key) => (
                  <div key={key.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono" dir="ltr">{key.key_prefix}…</span>
                    {key.revoked ? (
                      <span className="text-muted-foreground">{t({ ar: "ملغى", en: "Revoked" })}</span>
                    ) : (
                      <button
                        type="button"
                        className="text-prohibit"
                        onClick={async () => {
                          await revoke({ data: { id: key.id } });
                          await refresh();
                        }}
                      >
                        {t({ ar: "إلغاء", en: "Revoke" })}
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamTab({ orgId, canAdmin }: { orgId: string; canAdmin: boolean }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const list = useServerFn(orgMembers);
  const add = useServerFn(addOrgMember);
  const setRole = useServerFn(updateOrgMemberRole);
  const remove = useServerFn(removeOrgMember);
  const [email, setEmail] = useState("");
  const [role, setNewRole] = useState<"admin" | "manager" | "staff" | "viewer">("staff");

  const members = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => list({ data: { organization_id: orgId } }),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Users className="size-4 text-primary" /> {t({ ar: "فريق العمل", en: "Team" })}
      </h2>
      {canAdmin ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`${input} max-w-64`} dir="ltr" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <select className={`${input} max-w-40`} value={role} onChange={(e) => setNewRole(e.target.value as typeof role)}>
            {(["admin", "manager", "staff", "viewer"] as const).map((r) => (
              <option key={r} value={r}>{ORG_ROLES[r]}</option>
            ))}
          </select>
          <button
            type="button"
            className={primaryBtn}
            onClick={async () => {
              try {
                await add({ data: { organization_id: orgId, email: email.trim(), role } });
                setEmail("");
                await refresh();
                toast.success(t({ ar: "تمت إضافة العضو", en: "Member added" }));
              } catch (error) {
                const message = error instanceof Error ? error.message : "";
                toast.error(
                  message.includes("user_not_registered")
                    ? t({ ar: "لا يوجد حساب بهذا البريد — اطلب منه التسجيل أولاً", en: "No account with this email — ask them to sign up first" })
                    : message.includes("already_member")
                      ? t({ ar: "هذا الشخص عضو بالفعل", en: "This person is already a member" })
                      : t({ ar: "تعذرت الإضافة", en: "Couldn't add them" }),
                );
              }
            }}
          >
            <Plus className="size-3.5" /> {t({ ar: "إضافة", en: "Add" })}
          </button>
        </div>
      ) : null}

      <div className="mt-3 flex flex-col gap-2">
        {(members.data?.members ?? []).map((member) => (
          <div key={member.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2">
            <span className="text-sm" dir="ltr">{member.email ?? member.user_id.slice(0, 8)}</span>
            {member.role === "owner" || !canAdmin ? (
              <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-bold">{ORG_ROLES[member.role as OrgRole]}</span>
            ) : (
              <select
                className={`${input} max-w-36`}
                value={member.role}
                onChange={async (e) => {
                  await setRole({
                    data: {
                      organization_id: orgId,
                      member_id: member.id,
                      role: e.target.value as "admin" | "manager" | "staff" | "viewer",
                    },
                  });
                  await refresh();
                }}
              >
                {(["admin", "manager", "staff", "viewer"] as const).map((r) => (
                  <option key={r} value={r}>{ORG_ROLES[r]}</option>
                ))}
              </select>
            )}
            {canAdmin && member.role !== "owner" ? (
              <button
                type="button"
                className="ms-auto flex items-center gap-1 text-xs font-bold text-prohibit"
                onClick={async () => {
                  await remove({ data: { organization_id: orgId, member_id: member.id } });
                  await refresh();
                }}
              >
                <Trash2 className="size-3.5" /> {t({ ar: "إزالة", en: "Remove" })}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalyticsTab({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const fetchAnalytics = useServerFn(orgAnalytics);
  const [days, setDays] = useState(30);
  const stats = useQuery({
    queryKey: ["org-analytics", orgId, days],
    queryFn: () => fetchAnalytics({ data: { organization_id: orgId, days } }),
  });

  const cards = useMemo(
    () => [
      { label: t({ ar: "عمليات حلّ العنوان", en: "Address resolutions" }), value: stats.data?.totals.resolve ?? 0 },
      { label: t({ ar: "مسح رموز QR", en: "QR scans" }), value: stats.data?.totals.qr_scan ?? 0 },
      { label: t({ ar: "بدء التوجيه", en: "Navigation starts" }), value: stats.data?.totals.navigate_start ?? 0 },
      { label: t({ ar: "فتح وضع التوصيل", en: "Delivery mode opens" }), value: stats.data?.totals.delivery_view ?? 0 },
      { label: t({ ar: "ظهور في البحث", en: "Search appearances" }), value: stats.data?.totals.search_appearance ?? 0 },
      { label: t({ ar: "عدد المواقع", en: "Number of locations" }), value: stats.data?.locations_count ?? 0 },
    ],
    [stats.data, t],
  );

  const series = stats.data?.series ?? [];
  const peak = Math.max(1, ...series.map((s) => s.count));

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <BarChart3 className="size-4 text-primary" /> {t({ ar: "التحليلات", en: "Analytics" })}
        </h2>
        <select className={`${input} max-w-36`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>{t({ ar: "آخر 7 أيام", en: "Last 7 days" })}</option>
          <option value={30}>{t({ ar: "آخر 30 يوماً", en: "Last 30 days" })}</option>
          <option value={90}>{t({ ar: "آخر 90 يوماً", en: "Last 90 days" })}</option>
        </select>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {t({ ar: "أرقام مجمّعة فقط — لا تُسجَّل هوية أي زائر أو عميل.", en: "Aggregate numbers only — no visitor or customer identity is ever recorded." })}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map((item) => (
          <div key={item.label} className="rounded-lg border border-border p-3 text-center">
            <p className="font-mono text-xl font-bold">{item.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      {series.length ? (
        <div className="mt-4">
          <div className="flex h-24 items-end gap-0.5" dir="ltr">
            {series.map((point) => (
              <div
                key={point.day}
                title={`${point.day}: ${point.count}`}
                className="flex-1 rounded-t bg-primary/70"
                style={{ height: `${Math.max(2, (point.count / peak) * 100)}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{t({ ar: "النشاط اليومي", en: "Daily activity" })} · {t({ ar: "الذروة", en: "Peak" })} {peak}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {(stats.data?.per_location ?? []).map((row) => (
          <div key={row.code} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
            <span className="font-bold">{row.name}</span>
            <span className="font-mono text-muted-foreground" dir="ltr">{row.code}</span>
            <span className="ms-auto">{t({ ar: "حلّ", en: "Resolve" })}: {row.resolve}</span>
            <span>QR: {row.qr_scan}</span>
            <span>{t({ ar: "توجيه", en: "Navigate" })}: {row.navigate_start}</span>
            <span>{t({ ar: "توصيل", en: "Delivery" })}: {row.delivery_view}</span>
            <span>{t({ ar: "بحث", en: "Search" })}: {row.search_appearance}</span>
          </div>
        ))}
        {stats.data && stats.data.per_location.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t({ ar: "لا يوجد نشاط في هذه الفترة بعد.", en: "No activity in this period yet." })}</p>
        ) : null}
      </div>
    </section>
  );
}

function SettingsTab({
  organization,
  canAdmin,
}: {
  organization: {
    id: string;
    name_ar: string;
    name_en: string | null;
    logo_url: string | null;
    website: string | null;
    contact_phone: string | null;
    contact_email: string | null;
  };
  canAdmin: boolean;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const update = useServerFn(updateOrganization);
  const [form, setForm] = useState({
    name_ar: organization.name_ar,
    name_en: organization.name_en ?? "",
    logo_url: organization.logo_url ?? "",
    website: organization.website ?? "",
    contact_phone: organization.contact_phone ?? "",
    contact_email: organization.contact_email ?? "",
  });

  useEffect(() => {
    setForm({
      name_ar: organization.name_ar,
      name_en: organization.name_en ?? "",
      logo_url: organization.logo_url ?? "",
      website: organization.website ?? "",
      contact_phone: organization.contact_phone ?? "",
      contact_email: organization.contact_email ?? "",
    });
  }, [organization]);

  return (
    <div className="flex flex-col gap-4">
    <PlanCard orgId={organization.id} />
    <section className={card}>
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Settings className="size-4 text-primary" /> {t({ ar: "إعدادات الشركة", en: "Company settings" })}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label={t({ ar: "اسم الشركة (عربي)", en: "Company name (Arabic)" })}>
          <input className={input} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
        </Field>
        <Field label="Company name (English)">
          <input className={input} dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        </Field>
        <Field label={t({ ar: "رابط الشعار", en: "Logo URL" })}>
          <input className={input} dir="ltr" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
        </Field>
        <Field label={t({ ar: "الموقع الإلكتروني", en: "Website" })}>
          <input className={input} dir="ltr" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </Field>
        <Field label={t({ ar: "هاتف التواصل", en: "Contact phone" })}>
          <input className={input} dir="ltr" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
        </Field>
        <Field label={t({ ar: "بريد التواصل", en: "Contact email" })}>
          <input className={input} dir="ltr" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
        </Field>
      </div>
      {canAdmin ? (
        <button
          type="button"
          className={`${primaryBtn} mt-3`}
          onClick={async () => {
            try {
              await update({
                data: {
                  organization_id: organization.id,
                  name_ar: form.name_ar.trim(),
                  name_en: form.name_en.trim() || null,
                  logo_url: form.logo_url.trim() || null,
                  website: form.website.trim() || null,
                  contact_phone: form.contact_phone.trim() || null,
                  contact_email: form.contact_email.trim() || null,
                },
              });
              await queryClient.invalidateQueries({ queryKey: ["my-orgs"] });
              toast.success(t({ ar: "تم حفظ الإعدادات", en: "Settings saved" }));
            } catch {
              toast.error(t({ ar: "تعذر الحفظ", en: "Couldn't save" }));
            }
          }}
        >
          {t({ ar: "حفظ", en: "Save" })}
        </button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">{t({ ar: "تحتاج صلاحية مدير لتعديل الإعدادات.", en: "You need admin permission to edit settings." })}</p>
      )}
    </section>
    </div>
  );
}

/** Current plan + usage for this organization. No pricing is shown yet. */
function PlanCard({ orgId }: { orgId: string }) {
  const { t } = useI18n();
  const fetchEntitlements = useServerFn(myEntitlements);
  const query = useQuery({
    queryKey: ["org-entitlements", orgId],
    queryFn: () => fetchEntitlements({ data: { organization_id: orgId } }),
  });
  const data = query.data;
  if (!data) return null;
  const def = PLANS[data.plan];

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">{t({ ar: "الخطة الحالية", en: "Current plan" })}</h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
          {def.name_ar}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{def.tagline_ar}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["locations", data.usage.locations],
            ["team_members", data.usage.team_members],
            ["api_keys", data.usage.api_keys],
            ["webhooks", data.usage.webhooks],
          ] as [LimitKey, number][]
        ).map(([key, used]) => (
          <div key={key} className="rounded-lg border border-border p-3 text-center">
            <p className="font-mono text-lg font-bold">
              {used}
              <span className="text-xs text-muted-foreground"> / {formatLimit(def.limits[key])}</span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{LIMIT_LABELS_AR[key]}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link to="/plans" className="rounded-lg border border-border px-3 py-2 text-xs font-bold">
          {t({ ar: "مقارنة الخطط", en: "Compare plans" })}
        </Link>
        {!data.enforced ? (
          <span className="text-[11px] text-muted-foreground">
            {t({ ar: "الحدود للاطلاع فقط حالياً — لم تُعلَن الأسعار بعد.", en: "Limits are informational only for now — pricing hasn't been announced yet." })}
          </span>
        ) : null}
      </div>
    </section>
  );
}
