import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ROUTING_CONTEXTS } from "@/lib/routing-contexts";
import {
  deleteAccessPointContext,
  listAccessPointContexts,
  saveAccessPointContext,
} from "@/lib/routing-contexts.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, EyeOff, Globe, Pencil, QrCode, ShieldCheck, Star, Timer, Trash2 } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { DirectionsButton } from "@/components/DirectionsButton";
import { CadastralMap } from "@/components/CadastralMap";
import { QrCard } from "@/components/QrCard";
import { supabase } from "@/integrations/supabase/client";
import {
  createTemporaryAddress,
  listMyAddresses,
  listTemporaryLinks,
  revokeTemporaryLink,
  updateMyAddress,
  type ShareField,
} from "@/lib/addresses.functions";
import { myClaims, withdrawClaim } from "@/lib/claims.functions";
import { listFavorites, toggleFavorite } from "@/lib/network.functions";
import { nodeTypeLabel, purposeLabel, QUICK_PURPOSES, verificationLabel } from "@/lib/smart-address";
import { useI18n } from "@/lib/i18n";

const SHARE_FIELD_LABELS: { value: ShareField; ar: string; en: string }[] = [
  { value: "location", ar: "الموقع", en: "Location" },
  { value: "building", ar: "المبنى", en: "Building" },
  { value: "entrance", ar: "المدخل", en: "Entrance" },
  { value: "floor", ar: "الطابق", en: "Floor" },
  { value: "unit", ar: "الشقة", en: "Unit" },
  { value: "instructions", ar: "تعليمات الوصول", en: "Access instructions" },
  { value: "parking", ar: "المواقف", en: "Parking" },
  { value: "phone", ar: "الهاتف", en: "Phone" },
  { value: "name", ar: "الاسم", en: "Name" },
];

const EXPIRY_PRESETS = [
  { hours: 1, ar: "ساعة", en: "1 hour" },
  { hours: 24, ar: "٢٤ ساعة", en: "24 hours" },
  { hours: 168, ar: "٧ أيام", en: "7 days" },
];

const CLAIM_STATUS_LABELS: Record<string, { ar: string; en: string }> = {
  pending: { ar: "قيد المراجعة", en: "Under review" },
  approved: { ar: "مقبولة", en: "Approved" },
  rejected: { ar: "مرفوضة", en: "Rejected" },
  withdrawn: { ar: "مسحوبة", en: "Withdrawn" },
  superseded: { ar: "أُلغيت لصالح مطالبة أخرى", en: "Superseded by another claim" },
};


export const Route = createFileRoute("/my-addresses")({
  head: () => ({
    meta: [
      { title: "عناويني الذكية" },
      {
        name: "description",
        content:
          "أدر عناوينك الذكية: الخصوصية، مستوى التوثيق، ورموز QR، وأنشئ عناوين مؤقتة تنتهي تلقائياً لغرض محدد.",
      },
      { property: "og:title", content: "عناويني الذكية — الشبكة السورية" },
      {
        property: "og:description",
        content: "شارك وصولاً محدود المدة والغرض بدل كشف عنوانك الكامل.",
      },
    ],
  }),
  component: MyAddressesPage,
});

function MyAddressesPage() {
  const navigate = useNavigate();
  const { t, lang, date } = useI18n();
  const listFn = useServerFn(listMyAddresses);
  const tempFn = useServerFn(createTemporaryAddress);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string>("parcel_delivery");
  const [hours, setHours] = useState(24);
  const [oneUse, setOneUse] = useState(true);
  const [customExpiry, setCustomExpiry] = useState(false);
  const [fields, setFields] = useState<ShareField[]>([
    "location",
    "building",
    "entrance",
    "floor",
    "unit",
    "instructions",
  ]);
  const [contactPhone, setContactPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [issued, setIssued] = useState<{ token: string; expires_at: string } | null>(null);
  const updateFn = useServerFn(updateMyAddress);
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    label: "",
    is_public: false,
    display_name: "",
    neighborhood: "",
    street: "",
    landmark: "",
    public_notes: "",
    latitude: "",
    longitude: "",
    entrance_name: "",
    entrance_instructions: "",
    building_number: "",
    parking_info: "",
    loading_info: "",
    wheelchair_accessible: false,
    has_elevator: false,
    entrance_parking_info: "",
    entrance_loading_info: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["my-addresses"],
    queryFn: () => listFn({ data: undefined as never }),
    enabled: authed === true,
  });

  const favListFn = useServerFn(listFavorites);
  const favToggleFn = useServerFn(toggleFavorite);
  const favQuery = useQuery({
    queryKey: ["favorites"],
    queryFn: () => favListFn({ data: undefined as never }),
    enabled: authed === true,
  });

  const linksQueryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (smartAddressId: string) =>
      tempFn({
        data: {
          smart_address_id: smartAddressId,
          purpose,
          hours,
          one_use: oneUse,
          shared_fields: fields,
          label: linkLabel.trim() || undefined,
          contact_phone: contactPhone.trim() || undefined,
          contact_name: contactName.trim() || undefined,
        },
      }),
    onSuccess: async (row) => {
      setIssued({ token: row.token, expires_at: row.expires_at });
      toast.success(t({ ar: "تم إنشاء رابط مؤقت", en: "Temporary link created" }));
      await linksQueryClient.invalidateQueries({ queryKey: ["temp-links"] });
    },
    onError: () => toast.error(t({ ar: "تعذر إنشاء الرابط المؤقت", en: "Couldn't create the temporary link" })),
  });

  const editMutation = useMutation({
    mutationFn: (vars: { smart_address_id: string; node_id: string; access_point_id: string | null }) =>
      updateFn({
        data: {
          smart_address_id: vars.smart_address_id,
          node_id: vars.node_id,
          access_point_id: vars.access_point_id,
          label: editForm.label.trim() || null,
          is_public: editForm.is_public,
          display_name: editForm.display_name.trim(),
          neighborhood: editForm.neighborhood.trim() || null,
          street: editForm.street.trim() || null,
          landmark: editForm.landmark.trim() || null,
          public_notes: editForm.public_notes.trim() || null,
          latitude: editForm.latitude ? Number(editForm.latitude) : null,
          longitude: editForm.longitude ? Number(editForm.longitude) : null,
          entrance_name: editForm.entrance_name.trim() || null,
          entrance_instructions: editForm.entrance_instructions.trim() || null,
          building_number: editForm.building_number.trim() || null,
          parking_info: editForm.parking_info.trim() || null,
          loading_info: editForm.loading_info.trim() || null,
          wheelchair_accessible: editForm.wheelchair_accessible,
          has_elevator: editForm.has_elevator,
          entrance_parking_info: editForm.entrance_parking_info.trim() || null,
          entrance_loading_info: editForm.entrance_loading_info.trim() || null,
        },
      }),
    onSuccess: async () => {
      toast.success(t({ ar: "تم حفظ التعديلات", en: "Changes saved" }));
      setEditFor(null);
      await query.refetch();
    },
    onError: (err) =>
      toast.error(
        err instanceof Error && err.message === "not_found_or_forbidden"
          ? t({ ar: "لا تملك صلاحية تعديل هذا العنوان", en: "You don't have permission to edit this address" })
          : t({ ar: "تعذر حفظ التعديلات", en: "Couldn't save the changes" }),
      ),
  });

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">{t({ ar: "يلزم تسجيل الدخول", en: "Sign in required" })}</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/my-addresses" } })}
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
        <h1 className="text-lg font-bold">{t({ ar: "عناويني الذكية", en: "My smart addresses" })}</h1>

        <MyClaimsSection />


        {favQuery.data && favQuery.data.length ? (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Star className="size-3.5" /> {t({ ar: "المفضلة", en: "Favourites" })} ({favQuery.data.length})
            </h2>
            <div className="mt-3 space-y-2">
              {favQuery.data.map((fav) => {
                const smart = Array.isArray(fav.smart_addresses)
                  ? fav.smart_addresses[0]
                  : fav.smart_addresses;
                const node = smart?.location_nodes
                  ? Array.isArray(smart.location_nodes)
                    ? smart.location_nodes[0]
                    : smart.location_nodes
                  : null;
                if (!smart?.code) return null;
                return (
                  <div
                    key={fav.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-2.5"
                  >
                    <Link
                      to="/"
                      search={{ code: smart.code }}
                      className="flex min-w-0 flex-col"
                    >
                      <span className="font-mono text-xs" dir="ltr">
                        {smart.code}
                      </span>
                      <span className="truncate text-xs font-bold">
                        {node?.display_name ?? smart.label ?? fav.label}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {[node?.neighborhood, node?.city].filter(Boolean).join(" — ")}
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-label={t({ ar: "إزالة من المفضلة", en: "Remove from favourites" })}
                      onClick={async () => {
                        try {
                          await favToggleFn({ data: { code: smart.code!, label: fav.label } });
                          await favQuery.refetch();
                        } catch {
                          toast.error(t({ ar: "تعذر التحديث", en: "Couldn't update" }));
                        }
                      }}
                      className="grid size-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {query.isPending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t({ ar: "جارٍ التحميل…", en: "Loading…" })}</p>
        ) : null}

        {query.data?.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            {t({ ar: "لا عناوين بعد. أنشئ أول عنوان ذكي من صفحة الإنشاء.", en: "No addresses yet. Create your first smart address from the create page." })}
          </p>
        ) : null}

        {query.data?.map((row) => {
          const node = Array.isArray(row.location_nodes) ? row.location_nodes[0] : row.location_nodes;
          const ap = Array.isArray(row.access_points) ? row.access_points[0] : row.access_points;
          return (
            <section
              key={row.id}
              className="animate-entrance rounded-2xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg" dir="ltr">
                    {row.code}
                  </p>
                  <span className="mb-1 inline-block">
                    <DirectionsButton code={row.code} variant="chip" />
                  </span>
                  <p className="text-sm font-bold">{row.label ?? node?.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      node ? nodeTypeLabel(node.node_type, lang) : null,
                      node?.floor_label ? `${t({ ar: "الطابق", en: "Floor" })} ${node.floor_label}` : null,
                      node?.unit_label ? `${t({ ar: "وحدة", en: "Unit" })} ${node.unit_label}` : null,
                      node?.neighborhood,
                      node?.city,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${
                    row.is_public ? "bg-allow-surface text-allow" : "bg-secondary text-foreground"
                  }`}
                >
                  {row.is_public ? <Globe className="size-3" /> : <EyeOff className="size-3" />}
                  {row.is_public ? t({ ar: "عام", en: "Public" }) : t({ ar: "خاص", en: "Private" })}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {ap ? <span>{t({ ar: "المدخل:", en: "Entrance:" })} {ap.display_name}</span> : null}
                {node ? (
                  <span>
                    {verificationLabel(node.verification_level, lang)} ·{" "}
                    {node.confidence_score}%
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(row.code);
                    toast.success(t({ ar: "تم النسخ", en: "Copied" }));
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold"
                >
                  <Copy className="size-3.5" /> {t({ ar: "نسخ", en: "Copy" })}
                </button>
                {row.is_public ? (
                  <button
                    type="button"
                    onClick={() => setQrFor(row.id)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold"
                  >
                    <QrCode className="size-3.5" /> {t({ ar: "QR ولوحة", en: "QR & signage" })}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setOpenFor(openFor === row.id ? null : row.id);
                    setIssued(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background"
                >
                  <Timer className="size-3.5" /> {t({ ar: "عنوان مؤقت", en: "Temporary address" })}
                </button>
                {node?.id ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (editFor === row.id) {
                        setEditFor(null);
                        return;
                      }
                      setEditFor(row.id);
                      setEditForm({
                        label: row.label ?? "",
                        is_public: row.is_public,
                        display_name: node.display_name ?? "",
                        neighborhood: node.neighborhood ?? "",
                        street: node.street ?? "",
                        landmark: node.landmark ?? "",
                        public_notes: node.public_notes ?? "",
                        latitude: node.latitude != null ? String(node.latitude) : "",
                        longitude: node.longitude != null ? String(node.longitude) : "",
                        entrance_name: ap?.display_name ?? "",
                        entrance_instructions: ap?.instructions_ar ?? "",
                        building_number: node.building_number ?? "",
                        parking_info: node.parking_info ?? "",
                        loading_info: node.loading_info ?? "",
                        wheelchair_accessible: node.wheelchair_accessible ?? false,
                        has_elevator: node.has_elevator ?? false,
                        entrance_parking_info: ap?.parking_info ?? "",
                        entrance_loading_info: ap?.loading_info ?? "",
                      });
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold"
                  >
                    <Pencil className="size-3.5" /> {t({ ar: "تعديل", en: "Edit" })}
                  </button>
                ) : null}
              </div>

              {qrFor === row.id && row.is_public ? (
                <QrCard
                  url={
                    typeof window === "undefined"
                      ? `https://syriasan.com/a/${row.code}`
                      : `${window.location.origin}/a/${row.code}`
                  }
                  code={row.code}
                  title={row.label ?? node?.display_name ?? t({ ar: "عنوان ذكي", en: "Smart address" })}
                  subtitle={[node?.neighborhood, node?.city].filter(Boolean).join(" — ")}
                  onClose={() => setQrFor(null)}
                />
              ) : null}

              {editFor === row.id && node?.id ? (
                <div className="mt-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t({ ar: "تعديل العنوان — يُحفظ فوراً ويظهر للمشاركين", en: "Edit address — saves instantly and is visible to anyone it's shared with" })}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      اسم الموقع
                      <input
                        value={editForm.display_name}
                        onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      التسمية (تظهر لك فقط)
                      <input
                        value={editForm.label}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      الحي
                      <input
                        value={editForm.neighborhood}
                        onChange={(e) => setEditForm({ ...editForm, neighborhood: e.target.value })}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      الشارع
                      <input
                        value={editForm.street}
                        onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      معلم قريب
                      <input
                        value={editForm.landmark}
                        onChange={(e) => setEditForm({ ...editForm, landmark: e.target.value })}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      رقم المبنى
                      <input
                        value={editForm.building_number}
                        onChange={(e) => setEditForm({ ...editForm, building_number: e.target.value })}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      معلومات المواقف
                      <input
                        value={editForm.parking_info}
                        onChange={(e) => setEditForm({ ...editForm, parking_info: e.target.value })}
                        placeholder="موقف أمام المبنى، مجاني بعد الساعة 6"
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      التحميل والتنزيل
                      <input
                        value={editForm.loading_info}
                        onChange={(e) => setEditForm({ ...editForm, loading_info: e.target.value })}
                        placeholder="التنزيل من الجهة الخلفية"
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-4 self-end text-xs font-medium">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.wheelchair_accessible}
                          onChange={(e) =>
                            setEditForm({ ...editForm, wheelchair_accessible: e.target.checked })
                          }
                          className="size-3.5"
                        />
                        مناسب لكرسي متحرك
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editForm.has_elevator}
                          onChange={(e) => setEditForm({ ...editForm, has_elevator: e.target.checked })}
                          className="size-3.5"
                        />
                        يوجد مصعد
                      </label>
                    </div>
                    <label className="flex items-center gap-2 self-end text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={editForm.is_public}
                        onChange={(e) => setEditForm({ ...editForm, is_public: e.target.checked })}
                        className="size-3.5"
                      />
                      عنوان عام (قابل للبحث)
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      خط العرض
                      <input
                        value={editForm.latitude}
                        onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                        dir="ltr"
                        inputMode="decimal"
                        placeholder="33.5138"
                        className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                      خط الطول
                      <input
                        value={editForm.longitude}
                        onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
                        dir="ltr"
                        inputMode="decimal"
                        placeholder="36.2765"
                        className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <p className="mb-1.5 text-xs font-medium">
                        حدّد من الخريطة — انقر أو اسحب لاختيار الموقع تلقائياً
                      </p>
                      <CadastralMap
                        center={{
                          latitude: Number(editForm.latitude) || node.latitude || 33.5138,
                          longitude: Number(editForm.longitude) || node.longitude || 36.2765,
                        }}
                        spanMeters={420}
                        pins={
                          Number(editForm.latitude) && Number(editForm.longitude)
                            ? [
                                {
                                  id: `edit-${row.id}`,
                                  latitude: Number(editForm.latitude),
                                  longitude: Number(editForm.longitude),
                                  label: editForm.display_name || "الموقع المحدد",
                                  tone: "recommended",
                                },
                              ]
                            : []
                        }
                        onPick={({ latitude, longitude }) =>
                          setEditForm((f) => ({
                            ...f,
                            latitude: latitude.toFixed(6),
                            longitude: longitude.toFixed(6),
                          }))
                        }
                      />
                    </div>
                    <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-2">
                      ملاحظات عامة
                      <textarea
                        value={editForm.public_notes}
                        onChange={(e) => setEditForm({ ...editForm, public_notes: e.target.value })}
                        rows={2}
                        className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                    </label>
                    {ap?.id ? (
                      <>
                        <label className="flex flex-col gap-1 text-xs font-medium">
                          اسم المدخل
                          <input
                            value={editForm.entrance_name}
                            onChange={(e) => setEditForm({ ...editForm, entrance_name: e.target.value })}
                            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium">
                          تعليمات الوصول للمدخل
                          <input
                            value={editForm.entrance_instructions}
                            onChange={(e) =>
                              setEditForm({ ...editForm, entrance_instructions: e.target.value })
                            }
                            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium">
                          مواقف عند المدخل
                          <input
                            value={editForm.entrance_parking_info}
                            onChange={(e) =>
                              setEditForm({ ...editForm, entrance_parking_info: e.target.value })
                            }
                            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium">
                          تنزيل البضائع عند المدخل
                          <input
                            value={editForm.entrance_loading_info}
                            onChange={(e) =>
                              setEditForm({ ...editForm, entrance_loading_info: e.target.value })
                            }
                            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                          />
                        </label>
                      </>
                    ) : null}
                  </div>
                  {ap?.id ? <ContextInstructionsEditor accessPointId={ap.id} /> : null}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={
                        editMutation.isPending ||
                        editForm.display_name.trim().length < 2 ||
                        Boolean(editForm.latitude && Number.isNaN(Number(editForm.latitude))) ||
                        Boolean(editForm.longitude && Number.isNaN(Number(editForm.longitude)))
                      }
                      onClick={() =>
                        editMutation.mutate({
                          smart_address_id: row.id,
                          node_id: node.id!,
                          access_point_id: ap?.id ?? null,
                        })
                      }
                      className="flex-1 rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                    >
                      حفظ التعديلات
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditFor(null)}
                      className="rounded-lg border border-border px-4 py-2.5 text-xs font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : null}

              {openFor === row.id ? (
                <div className="mt-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    مشاركة محدودة الغرض والمدة
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_PURPOSES.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPurpose(value)}
                        className={`rounded-full px-3 py-1 text-xs ${
                          purpose === value
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground"
                        }`}
                      >
                        {PURPOSE_LABELS[value]}
                      </button>
                    ))}
                  </div>

                  <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    ما الذي يراه المستلم؟
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                    {SHARE_FIELD_LABELS.map((f) => {
                      const on = fields.includes(f.value);
                      return (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() =>
                            setFields((prev) =>
                              prev.includes(f.value)
                                ? prev.filter((v) => v !== f.value)
                                : [...prev, f.value],
                            )
                          }
                          className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-xs ${
                            on
                              ? "border-primary/50 bg-primary/10 font-bold text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          <span>{f.ar}</span>
                          <span>{on ? "✓" : "✕"}</span>
                        </button>
                      );
                    })}
                  </div>
                  {fields.includes("phone") ? (
                    <input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="رقم الهاتف الذي سيظهر للمستلم"
                      dir="ltr"
                      className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  ) : null}
                  {fields.includes("name") ? (
                    <input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="الاسم الذي سيظهر للمستلم"
                      className="mt-2 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    />
                  ) : null}

                  <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    مدة الصلاحية
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {EXPIRY_PRESETS.map((preset) => (
                      <button
                        key={preset.hours}
                        type="button"
                        onClick={() => {
                          setCustomExpiry(false);
                          setHours(preset.hours);
                        }}
                        className={`rounded-lg px-3 py-1.5 ${
                          !customExpiry && hours === preset.hours
                            ? "bg-foreground text-background"
                            : "border border-border"
                        }`}
                      >
                        {preset.ar}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCustomExpiry(true)}
                      className={`rounded-lg px-3 py-1.5 ${
                        customExpiry ? "bg-foreground text-background" : "border border-border"
                      }`}
                    >
                      مدة مخصصة
                    </button>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={oneUse}
                        onChange={(event) => setOneUse(event.target.checked)}
                        className="size-3.5"
                      />
                      استخدام واحد
                    </label>
                  </div>
                  {customExpiry ? (
                    <label className="mt-2 flex items-center gap-2 text-xs">
                      <input
                        type="number"
                        min={1}
                        max={8760}
                        value={hours}
                        onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 1))}
                        className="w-28 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                      />
                      ساعة
                    </label>
                  ) : null}

                  <input
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="وسم للرابط (اختياري) — مثلاً: طلب طعام"
                    className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />

                  <button
                    type="button"
                    disabled={mutation.isPending || fields.length === 0}
                    onClick={() => mutation.mutate(row.id)}
                    className="mt-3 w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                  >
                    إنشاء رابط مؤقت
                  </button>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    الرابط المؤقت لا يجعل عنوانك قابلاً للبحث — يبقى خاصاً وينتهي تلقائياً.
                  </p>

                  {issued ? (
                    <QrCard
                      url={
                        typeof window === "undefined"
                          ? `https://syriasan.com/t/${issued.token}`
                          : `${window.location.origin}/t/${issued.token}`
                      }
                      code={issued.token}
                      title={row.label ?? node?.display_name ?? "عنوان مؤقت"}
                      subtitle={`${PURPOSE_LABELS[purpose] ?? purpose} · ينتهي ${new Date(issued.expires_at).toLocaleString("ar-SY")}`}
                      onClose={() => setIssued(null)}
                    />
                  ) : null}

                  <TemporaryLinksList smartAddressId={row.id} />
                </div>
              ) : null}
            </section>
          );
        })}
      </main>
    </div>
  );
}

function MyClaimsSection() {
  const queryClient = useQueryClient();
  const listClaims = useServerFn(myClaims);
  const withdrawFn = useServerFn(withdrawClaim);

  const claimsQuery = useQuery({
    queryKey: ["my-claims"],
    queryFn: () => listClaims({ data: undefined as never }),
  });

  const claims = claimsQuery.data?.claims ?? [];
  if (!claims.length) return null;

  const withdraw = async (id: string) => {
    try {
      const res = await withdrawFn({ data: { id } });
      if (res.ok) {
        toast.success("تم سحب الطلب");
        await queryClient.invalidateQueries({ queryKey: ["my-claims"] });
      } else {
        toast.error("الطلب لم يعد معلّقاً");
      }
    } catch {
      toast.error("تعذّر سحب الطلب");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <ShieldCheck className="size-3.5" /> مطالبات الملكية ({claims.length})
      </h2>
      <div className="mt-3 space-y-2">
        {claims.map((claim) => {
          const biz = Array.isArray(claim.businesses) ? claim.businesses[0] : claim.businesses;
          return (
            <div key={claim.id} className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold">{biz?.name_ar ?? "عمل"}</span>
                <span className="text-xs text-muted-foreground">
                  {CLAIM_STATUS_LABELS[claim.status] ?? claim.status} ·{" "}
                  {new Date(claim.created_at).toLocaleDateString("ar-SY")}
                </span>
              </div>
              {claim.granted_level ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  المستوى الممنوح: {VERIFICATION_LEVELS[claim.granted_level]?.ar ?? claim.granted_level}
                </p>
              ) : null}
              {claim.review_notes ? (
                <p className="mt-1 text-xs text-muted-foreground">ملاحظة المراجع: {claim.review_notes}</p>
              ) : null}
              <div className="mt-2 flex gap-2">
                <Link
                  to="/business/$id"
                  params={{ id: claim.business_id }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold"
                >
                  ملف العمل
                </Link>
                {claim.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => withdraw(claim.id)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-destructive"
                  >
                    سحب الطلب
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TemporaryLinksList({ smartAddressId }: { smartAddressId: string }) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listTemporaryLinks);
  const revokeFn = useServerFn(revokeTemporaryLink);

  const linksQuery = useQuery({
    queryKey: ["temp-links", smartAddressId],
    queryFn: () => listFn({ data: { smart_address_id: smartAddressId } }),
  });

  const links = linksQuery.data ?? [];
  if (!links.length) return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        الروابط المؤقتة
      </p>
      <div className="mt-2 space-y-2">
        {links.map((link) => {
          const expired = new Date(link.expires_at).getTime() < Date.now();
          const used = link.max_uses != null && link.use_count >= link.max_uses;
          const dead = link.revoked || expired || used;
          return (
            <div
              key={link.id}
              className="rounded-lg border border-border bg-surface p-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold" dir="ltr">
                  {link.token}
                </span>
                <span className={dead ? "text-muted-foreground" : "text-allow font-bold"}>
                  {link.revoked
                    ? "ملغى"
                    : expired
                      ? "منتهٍ"
                      : used
                        ? "استُخدم"
                        : "فعّال"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {[
                  link.label,
                  PURPOSE_LABELS[link.purpose] ?? link.purpose,
                  `ينتهي ${new Date(link.expires_at).toLocaleString("ar-SY")}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                يكشف:{" "}
                {(link.shared_fields ?? [])
                  .map((f) => SHARE_FIELD_LABELS.find((s) => s.value === f)?.ar ?? f)
                  .join("، ")}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(`${window.location.origin}/t/${link.token}`);
                    toast.success("تم نسخ الرابط");
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 font-bold"
                >
                  نسخ الرابط
                </button>
                {!dead ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await revokeFn({ data: { id: link.id } });
                        toast.success("تم إلغاء الرابط");
                        await queryClient.invalidateQueries({ queryKey: ["temp-links"] });
                      } catch {
                        toast.error("تعذّر إلغاء الرابط");
                      }
                    }}
                    className="rounded-lg border border-prohibit/40 px-3 py-1.5 font-bold text-prohibit"
                  >
                    إلغاء
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Phase 18 — per-context approach instructions for one entrance. */
function ContextInstructionsEditor({ accessPointId }: { accessPointId: string }) {
  const listFn = useServerFn(listAccessPointContexts);
  const saveFn = useServerFn(saveAccessPointContext);
  const deleteFn = useServerFn(deleteAccessPointContext);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    approach_ar: "",
    preferred_road: "",
    vehicle_note: "",
    allowed: true,
  });

  const query = useQuery({
    queryKey: ["ap-contexts", accessPointId],
    queryFn: () => listFn({ data: { accessPointId } }),
  });

  const saveMutation = useMutation({
    mutationFn: (context: string) =>
      saveFn({ data: { accessPointId, context, ...draft } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error("تعذر الحفظ");
        return;
      }
      toast.success("تم حفظ تعليمات السياق");
      setOpen(null);
      void queryClient.invalidateQueries({ queryKey: ["ap-contexts", accessPointId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (context: string) => deleteFn({ data: { accessPointId, context } }),
    onSuccess: () => {
      toast.success("تم حذف تعليمات السياق");
      void queryClient.invalidateQueries({ queryKey: ["ap-contexts", accessPointId] });
    },
  });

  const rows = query.data ?? [];

  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        تعليمات الوصول حسب السياق
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        عرّف كيف يصل كل نوع زائر: الزائر من الباب الرئيسي، الشاحنة من الطريق الصناعي، الإسعاف من
        البوابة الشرقية.
      </p>
      <div className="mt-2 space-y-1.5">
        {ROUTING_CONTEXTS.map((ctx) => {
          const row = rows.find((r) => r.context === ctx.value);
          const isOpen = open === ctx.value;
          return (
            <div key={ctx.value} className="rounded-lg border border-border p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold">{ctx.ar}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row
                      ? row.allowed
                        ? (row.approach_ar ?? row.preferred_road ?? "معرّف")
                        : "ممنوع لهذا السياق"
                      : "غير معرّف — يُستخدم المدخل الافتراضي"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(isOpen ? null : ctx.value);
                      setDraft({
                        approach_ar: row?.approach_ar ?? "",
                        preferred_road: row?.preferred_road ?? "",
                        vehicle_note: row?.vehicle_note ?? "",
                        allowed: row?.allowed ?? true,
                      });
                    }}
                    className="rounded-md border border-border px-2 py-1 text-[11px] font-bold"
                  >
                    {isOpen ? "إغلاق" : row ? "تعديل" : "إضافة"}
                  </button>
                  {row ? (
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(ctx.value)}
                      className="rounded-md border border-border px-2 py-1 text-[11px] font-bold text-destructive"
                    >
                      حذف
                    </button>
                  ) : null}
                </div>
              </div>

              {isOpen ? (
                <div className="mt-2 space-y-1.5">
                  <input
                    value={draft.approach_ar}
                    onChange={(e) => setDraft({ ...draft, approach_ar: e.target.value })}
                    placeholder="تعليمات الوصول لهذا السياق"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                  <input
                    value={draft.preferred_road}
                    onChange={(e) => setDraft({ ...draft, preferred_road: e.target.value })}
                    placeholder="الطريق المفضل للاقتراب"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                  <input
                    value={draft.vehicle_note}
                    onChange={(e) => setDraft({ ...draft, vehicle_note: e.target.value })}
                    placeholder="ملاحظة المركبة (مثلاً: شاحنات حتى 12 متراً)"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 text-[11px] font-medium">
                    <input
                      type="checkbox"
                      checked={draft.allowed}
                      onChange={(e) => setDraft({ ...draft, allowed: e.target.checked })}
                    />
                    هذا المدخل مسموح لهذا السياق
                  </label>
                  <button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate(ctx.value)}
                    className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
                  >
                    حفظ
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
