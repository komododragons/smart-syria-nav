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
import { BulkImportTab } from "@/components/BulkImportTab";
import { CadastralMap } from "@/components/CadastralMap";
import { QrCard } from "@/components/QrCard";
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
import { GOVERNORATES, VERIFICATION_LEVELS } from "@/lib/smart-address";

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

const TABS: { key: TabKey; label: string; icon: typeof Building2 }[] = [
  { key: "locations", label: "المواقع", icon: Building2 },
  { key: "addresses", label: "العناوين", icon: MapPinned },
  { key: "import", label: "استيراد وتصدير", icon: FileSpreadsheet },
  { key: "verification", label: "التوثيق", icon: BadgeCheck },
  { key: "qr", label: "رموز QR", icon: QrCode },
  { key: "plates", label: "لوحات العنوان", icon: LayoutTemplate },
  { key: "api", label: "الواجهة البرمجية", icon: Code2 },
  { key: "team", label: "الفريق", icon: Users },
  { key: "analytics", label: "التحليلات", icon: BarChart3 },
  { key: "settings", label: "الإعدادات", icon: Settings },
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
          <h1 className="text-xl font-bold">لوحة إدارة الأعمال</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            سجّل الدخول لإدارة فروع شركتك وعناوينها الذكية.
          </p>
          <button
            type="button"
            className={`${primaryBtn} mx-auto mt-4`}
            onClick={() => void navigate({ to: "/auth", search: { redirect: "/dashboard" } })}
          >
            تسجيل الدخول
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
              لوحة إدارة الأعمال
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              فرع واحد أو آلاف الفروع — إدارة موحّدة للعناوين الذكية.
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
          <p className="py-16 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
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
                  {label}
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
  const queryClient = useQueryClient();
  const create = useServerFn(createOrganization);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <section className={card}>
      <h2 className="text-sm font-bold">أنشئ حساب شركة</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        الحساب يجمع كل فروعك تحت إدارة واحدة مع صلاحيات فريق.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="اسم الشركة (عربي)">
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
            toast.success("تم إنشاء حساب الشركة");
          } catch {
            toast.error("تعذر إنشاء الحساب");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Plus className="size-3.5" /> إنشاء
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
        branch_label: form.branch_label.trim() || null,
        category: form.category.trim() || null,
        place_category: form.place_category || null,
        phone: form.phone.trim() || null,
        opening_hours: form.opening_hours.trim() || null,
        governorate,
        governorate_code: form.governorate_code,
        city: form.city.trim() || null,
        neighborhood: form.neighborhood.trim() || null,
        street: form.street.trim() || null,
        landmark: form.landmark.trim() || null,
        building_number: form.building_number.trim() || null,
        latitude: form.latitude,
        longitude: form.longitude,
        entrance_name: form.entrance_name.trim() || null,
        entrance_instructions: form.entrance_instructions.trim() || null,
        is_published: form.is_published,
      };
      if (form.business_id && form.node_id) {
        await update({ data: { ...payload, business_id: form.business_id, node_id: form.node_id } });
        toast.success("تم تحديث الموقع");
      } else {
        const res = await create({ data: payload });
        toast.success(`تم إنشاء الموقع — ${res.code}`);
      }
      setForm(null);
      await refresh();
    } catch {
      toast.error("تعذر حفظ الموقع");
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
          إظهار المؤرشفة
        </label>
        {canManage ? (
          <button type="button" className={primaryBtn} onClick={() => setForm({ ...emptyForm })}>
            <Plus className="size-3.5" /> موقع جديد
          </button>
        ) : null}
      </div>

      {canAdmin && loose.data?.length ? (
        <section className={card}>
          <h3 className="text-sm font-bold">مواقع تملكها ولم تُضف إلى الشركة</h3>
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
                      toast.success("تمت إضافة الموقع إلى الشركة");
                    } catch {
                      toast.error("تعذرت الإضافة");
                    }
                  }}
                >
                  ضمّ إلى الشركة
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {form ? (
        <section className={card}>
          <h3 className="text-sm font-bold">{form.business_id ? "تعديل موقع" : "موقع جديد"}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="اسم الموقع">
              <input className={input} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </Field>
            <Field label="اسم الفرع">
              <input className={input} value={form.branch_label} onChange={(e) => setForm({ ...form, branch_label: e.target.value })} />
            </Field>
            <Field label="الفئة">
              <input className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label="تصنيف الدليل العام">
              <select
                className={input}
                value={form.place_category}
                onChange={(e) => setForm({ ...form, place_category: e.target.value })}
              >
                <option value="">بدون تصنيف عام</option>
                {PLACE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.emoji} {c.ar}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الهاتف">
              <input className={input} dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="ساعات العمل">
              <input className={input} value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} />
            </Field>
            <Field label="المحافظة">
              <select className={input} value={form.governorate_code} onChange={(e) => setForm({ ...form, governorate_code: e.target.value })}>
                {GOVERNORATES.map((g) => (
                  <option key={g.code} value={g.code}>{g.ar}</option>
                ))}
              </select>
            </Field>
            <Field label="المدينة">
              <input className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="الحي">
              <input className={input} value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
            </Field>
            <Field label="الشارع">
              <input className={input} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
            </Field>
            <Field label="أقرب معلم">
              <input className={input} value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
            </Field>
            <Field label="رقم المبنى">
              <input className={input} value={form.building_number} onChange={(e) => setForm({ ...form, building_number: e.target.value })} />
            </Field>
            <Field label="اسم المدخل">
              <input className={input} value={form.entrance_name} onChange={(e) => setForm({ ...form, entrance_name: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="تعليمات الوصول إلى المدخل">
                <textarea
                  className={`${input} min-h-20`}
                  value={form.entrance_instructions}
                  onChange={(e) => setForm({ ...form, entrance_instructions: e.target.value })}
                />
              </Field>
            </div>
          </div>

          <p className="mt-3 text-xs font-bold text-muted-foreground">اختر الموقع على الخريطة</p>
          <div className="mt-2">
            <CadastralMap
              center={{ latitude: form.latitude, longitude: form.longitude }}
              pins={[
                {
                  id: "draft",
                  latitude: form.latitude,
                  longitude: form.longitude,
                  label: form.name_ar || "الموقع",
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
            منشور للعامة
          </label>

          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy || form.name_ar.trim().length < 2} className={`${primaryBtn} disabled:opacity-50`} onClick={() => void save()}>
              حفظ
            </button>
            <button type="button" className={ghostBtn} onClick={() => setForm(null)}>
              إلغاء
            </button>
          </div>
        </section>
      ) : null}

      {locations.isPending ? <p className="text-sm text-muted-foreground">جارٍ التحميل…</p> : null}
      {locations.data && locations.data.locations.length === 0 ? (
        <p className={`${card} text-center text-sm text-muted-foreground`}>لا توجد مواقع بعد.</p>
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
                {[loc.node?.neighborhood, loc.node?.city, loc.node?.governorate].filter(Boolean).join(" — ") || "بدون تفاصيل موقع"}
              </p>
              {loc.smart_code ? (
                <p className="mt-1 font-mono text-sm font-bold" dir="ltr">{loc.smart_code}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {loc.is_archived ? (
                <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-bold text-muted-foreground">مؤرشف</span>
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
                      })
                    }
                  >
                    <Pencil className="size-3.5" /> تعديل
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
                        toast.success(loc.is_archived ? "تمت الاستعادة" : "تمت الأرشفة");
                      } catch {
                        toast.error("تعذر التنفيذ");
                      }
                    }}
                  >
                    {loc.is_archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
                    {loc.is_archived ? "استعادة" : "أرشفة"}
                  </button>
                </>
              ) : null}
              {loc.smart_code ? (
                <Link to="/a/$code" params={{ code: loc.smart_code }} className={ghostBtn}>
                  فتح العنوان
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
  const locations = useLocations(orgId, true);
  const rows = locations.data?.locations ?? [];
  return (
    <section className={card}>
      <h2 className="text-sm font-bold">العناوين الذكية ({rows.length})</h2>
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
                      toast.success("تم نسخ الرمز");
                    }}
                  >
                    نسخ
                  </button>
                  <Link to="/a/$code" params={{ code: loc.smart_code }} className={ghostBtn}>
                    البطاقة
                  </Link>
                  <Link to="/d/$code" params={{ code: loc.smart_code }} className={ghostBtn}>
                    وضع التوصيل
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عناوين بعد.</p> : null}
      </div>
    </section>
  );
}

function VerificationTab({ orgId }: { orgId: string }) {
  const locations = useLocations(orgId, false);
  const rows = locations.data?.locations ?? [];
  return (
    <section className={card}>
      <h2 className="text-sm font-bold">حالة التوثيق</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        ارفع مستوى التوثيق عبر المطالبة بالملكية ومراجعة فريق سيرياسان.
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
              {VERIFICATION_LEVELS[loc.verification_level]?.ar ?? "غير موثق"}
            </span>
            {loc.node?.last_verified_at ? (
              <span className="text-[11px] text-muted-foreground">
                آخر توثيق: {new Date(loc.node.last_verified_at).toLocaleDateString("ar-SY")}
              </span>
            ) : null}
            <Link to="/claim/$id" params={{ id: loc.id }} className={`${ghostBtn} ms-auto`}>
              طلب توثيق الملكية
            </Link>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد مواقع.</p> : null}
      </div>
    </section>
  );
}

function CodesTab({ orgId, plate }: { orgId: string; plate: boolean }) {
  const locations = useLocations(orgId, false);
  const rows = (locations.data?.locations ?? []).filter((loc) => loc.smart_code);
  const [open, setOpen] = useState<string | null>(null);
  const current = rows.find((loc) => loc.id === open) ?? null;

  return (
    <section className={card}>
      <h2 className="text-sm font-bold">{plate ? "لوحات العنوان" : "رموز QR"}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {plate
          ? "اطبع لوحة بمقاسات A6 وA5 وA4 وملصق ولوحة باب وواجهة محل، مع شعار الشركة."
          : "نزّل أو شارك رمز QR يفتح صفحة العنوان العامة للفرع."}
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
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عناوين بعد.</p> : null}
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
        <KeyRound className="size-4 text-primary" /> الواجهة البرمجية
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        استخدم مفاتيح الوصول لحلّ رموز سيرياسان داخل أنظمتك. راجع
        <Link to="/developers" className="mx-1 text-primary">دليل المطورين</Link>.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <input className={`${input} max-w-60`} placeholder="اسم التطبيق" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          disabled={name.trim().length < 2}
          className={`${primaryBtn} disabled:opacity-50`}
          onClick={async () => {
            try {
              await createClient({ data: { name: name.trim(), environment: "live" } });
              setName("");
              await refresh();
              toast.success("تم إنشاء التطبيق");
            } catch {
              toast.error("تعذر الإنشاء");
            }
          }}
        >
          <Plus className="size-3.5" /> تطبيق جديد
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
                    toast.error("تعذر إنشاء المفتاح");
                  }
                }}
              >
                مفتاح جديد
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-1">
              {(clients.data?.keys ?? [])
                .filter((key) => key.client_id === client.id)
                .map((key) => (
                  <div key={key.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono" dir="ltr">{key.key_prefix}…</span>
                    {key.revoked ? (
                      <span className="text-muted-foreground">ملغى</span>
                    ) : (
                      <button
                        type="button"
                        className="text-prohibit"
                        onClick={async () => {
                          await revoke({ data: { id: key.id } });
                          await refresh();
                        }}
                      >
                        إلغاء
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
        <Users className="size-4 text-primary" /> فريق العمل
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
                toast.success("تمت إضافة العضو");
              } catch (error) {
                const message = error instanceof Error ? error.message : "";
                toast.error(
                  message.includes("user_not_registered")
                    ? "لا يوجد حساب بهذا البريد — اطلب منه التسجيل أولاً"
                    : message.includes("already_member")
                      ? "هذا الشخص عضو بالفعل"
                      : "تعذرت الإضافة",
                );
              }
            }}
          >
            <Plus className="size-3.5" /> إضافة
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
                <Trash2 className="size-3.5" /> إزالة
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalyticsTab({ orgId }: { orgId: string }) {
  const fetchAnalytics = useServerFn(orgAnalytics);
  const [days, setDays] = useState(30);
  const stats = useQuery({
    queryKey: ["org-analytics", orgId, days],
    queryFn: () => fetchAnalytics({ data: { organization_id: orgId, days } }),
  });

  const cards = useMemo(
    () => [
      { label: "عمليات حلّ العنوان", value: stats.data?.totals.resolve ?? 0 },
      { label: "بدء التوجيه", value: stats.data?.totals.navigate_start ?? 0 },
      { label: "فتح وضع التوصيل", value: stats.data?.totals.delivery_view ?? 0 },
      { label: "عدد المواقع", value: stats.data?.locations_count ?? 0 },
    ],
    [stats.data],
  );

  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <BarChart3 className="size-4 text-primary" /> التحليلات
        </h2>
        <select className={`${input} max-w-36`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>آخر 7 أيام</option>
          <option value={30}>آخر 30 يوماً</option>
          <option value={90}>آخر 90 يوماً</option>
        </select>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((item) => (
          <div key={item.label} className="rounded-lg border border-border p-3 text-center">
            <p className="font-mono text-xl font-bold">{item.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {(stats.data?.per_location ?? []).map((row) => (
          <div key={row.code} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
            <span className="font-bold">{row.name}</span>
            <span className="font-mono text-muted-foreground" dir="ltr">{row.code}</span>
            <span className="ms-auto">حلّ: {row.resolve}</span>
            <span>توجيه: {row.navigate_start}</span>
          </div>
        ))}
        {stats.data && stats.data.per_location.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا يوجد نشاط في هذه الفترة بعد.</p>
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
    <section className={card}>
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Settings className="size-4 text-primary" /> إعدادات الشركة
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="اسم الشركة (عربي)">
          <input className={input} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
        </Field>
        <Field label="Company name (English)">
          <input className={input} dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        </Field>
        <Field label="رابط الشعار">
          <input className={input} dir="ltr" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
        </Field>
        <Field label="الموقع الإلكتروني">
          <input className={input} dir="ltr" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        </Field>
        <Field label="هاتف التواصل">
          <input className={input} dir="ltr" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
        </Field>
        <Field label="بريد التواصل">
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
              toast.success("تم حفظ الإعدادات");
            } catch {
              toast.error("تعذر الحفظ");
            }
          }}
        >
          حفظ
        </button>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">تحتاج صلاحية مدير لتعديل الإعدادات.</p>
      )}
    </section>
  );
}
