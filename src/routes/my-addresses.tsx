import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, EyeOff, Globe, Timer } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { QrCard } from "@/components/QrCard";
import { supabase } from "@/integrations/supabase/client";
import { createTemporaryAddress, listMyAddresses } from "@/lib/addresses.functions";
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["my-addresses"],
    queryFn: () => listFn({ data: undefined as never }),
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
              </div>

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
