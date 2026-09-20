import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, EyeOff, Globe, Pencil, Star, Timer, Trash2 } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { DirectionsButton } from "@/components/DirectionsButton";
import { CadastralMap } from "@/components/CadastralMap";
import { QrCard } from "@/components/QrCard";
import { supabase } from "@/integrations/supabase/client";
import { createTemporaryAddress, listMyAddresses, updateMyAddress } from "@/lib/addresses.functions";
import { listFavorites, toggleFavorite } from "@/lib/network.functions";
import { NODE_TYPE_LABELS, PURPOSE_LABELS, QUICK_PURPOSES, VERIFICATION_LEVELS } from "@/lib/smart-address";

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
  const listFn = useServerFn(listMyAddresses);
  const tempFn = useServerFn(createTemporaryAddress);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string>("parcel_delivery");
  const [hours, setHours] = useState(24);
  const [oneUse, setOneUse] = useState(true);
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

  const mutation = useMutation({
    mutationFn: (smartAddressId: string) =>
      tempFn({ data: { smart_address_id: smartAddressId, purpose, hours, one_use: oneUse } }),
    onSuccess: (row) => {
      setIssued({ token: row.token, expires_at: row.expires_at });
      toast.success("تم إنشاء عنوان مؤقت");
    },
    onError: () => toast.error("تعذر إنشاء العنوان المؤقت"),
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
      toast.success("تم حفظ التعديلات");
      setEditFor(null);
      await query.refetch();
    },
    onError: (err) =>
      toast.error(
        err instanceof Error && err.message === "not_found_or_forbidden"
          ? "لا تملك صلاحية تعديل هذا العنوان"
          : "تعذر حفظ التعديلات",
      ),
  });

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold">يلزم تسجيل الدخول</h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/auth", search: { redirect: "/my-addresses" } })}
            className="mt-6 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            الدخول
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="text-lg font-bold">عناويني الذكية</h1>

        {favQuery.data && favQuery.data.length ? (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Star className="size-3.5" /> المفضلة ({favQuery.data.length})
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
                      aria-label="إزالة من المفضلة"
                      onClick={async () => {
                        try {
                          await favToggleFn({ data: { code: smart.code!, label: fav.label } });
                          await favQuery.refetch();
                        } catch {
                          toast.error("تعذر التحديث");
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
          <p className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : null}

        {query.data?.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            لا عناوين بعد. أنشئ أول عنوان ذكي من صفحة الإنشاء.
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
                      node ? (NODE_TYPE_LABELS[node.node_type] ?? node.node_type) : null,
                      node?.floor_label ? `الطابق ${node.floor_label}` : null,
                      node?.unit_label ? `وحدة ${node.unit_label}` : null,
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
                  {row.is_public ? "عام" : "خاص"}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {ap ? <span>المدخل: {ap.display_name}</span> : null}
                {node ? (
                  <span>
                    {VERIFICATION_LEVELS[node.verification_level]?.ar ?? "غير موثق"} ·{" "}
                    {node.confidence_score}%
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(row.code);
                    toast.success("تم النسخ");
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold"
                >
                  <Copy className="size-3.5" /> نسخ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenFor(openFor === row.id ? null : row.id);
                    setIssued(null);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background"
                >
                  <Timer className="size-3.5" /> عنوان مؤقت
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
                    <Pencil className="size-3.5" /> تعديل
                  </button>
                ) : null}
              </div>

              {editFor === row.id && node?.id ? (
                <div className="mt-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    تعديل العنوان — يُحفظ فوراً ويظهر للمشاركين
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
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {[6, 24, 72].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setHours(value)}
                        className={`rounded-lg px-3 py-1.5 ${
                          hours === value ? "bg-foreground text-background" : "border border-border"
                        }`}
                      >
                        {value} ساعة
                      </button>
                    ))}
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
                  <button
                    type="button"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(row.id)}
                    className="mt-3 w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                  >
                    إنشاء رمز مؤقت
                  </button>

                  {issued ? (
                    <QrCard
                      url={
                        typeof window === "undefined"
                          ? `https://smartaddress.sy/t/${issued.token}`
                          : `${window.location.origin}/t/${issued.token}`
                      }
                      code={issued.token}
                      title={row.label ?? node?.display_name ?? "عنوان مؤقت"}
                      subtitle={`${PURPOSE_LABELS[purpose] ?? purpose} · ينتهي ${new Date(issued.expires_at).toLocaleString("ar-SY")}`}
                      onClose={() => setIssued(null)}
                    />
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </main>
    </div>
  );
}
