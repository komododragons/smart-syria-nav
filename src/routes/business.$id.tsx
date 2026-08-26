import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bike,
  Clock,
  Globe,
  Handshake,
  MapPin as MapPinIcon,
  Navigation,
  Phone,
  QrCode,
  Store,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { QrCard } from "@/components/QrCard";
import { CadastralMap, type MapPin as CadMapPin } from "@/components/CadastralMap";
import { supabase } from "@/integrations/supabase/client";
import { claimBusiness, getBusinessProfile } from "@/lib/addresses.functions";
import {
  ACCESSIBILITY_LABELS,
  VERIFICATION_LEVELS,
  formatCoords,
  osmDirectionsUrl,
} from "@/lib/smart-address";

export const Route = createFileRoute("/business/$id")({
  head: () => ({
    meta: [
      { title: "ملف العمل | شبكة العنوان الذكي السورية" },
      {
        name: "description",
        content:
          "ملف عمل موثق على شبكة العنوان الذكي: العنوان الذكي، مداخل الزوار والتوصيل، ساعات العمل، ورمز QR للمشاركة.",
      },
      { property: "og:title", content: "ملف عمل — شبكة العنوان الذكي السورية" },
      {
        property: "og:description",
        content: "مدخل دقيق لكل غرض: زوار، توصيل طرود، أو شحن ثقيل.",
      },
    ],
  }),
  component: BusinessPage,
});

function BusinessPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getBusinessProfile);
  const claim = useServerFn(claimBusiness);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [claimState, setClaimState] = useState<"idle" | "pending" | "owner">("idle");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const query = useQuery({
    queryKey: ["business", id],
    queryFn: () => fetchProfile({ data: { id } }),
  });

  const claimMutation = useMutation({
    mutationFn: () => claim({ data: { business_id: id, evidence: evidence.trim() || undefined } }),
    onSuccess: (result) => {
      if (result.status === "submitted") {
        setClaimState("pending");
        setClaimOpen(false);
        toast.success("أُرسل طلب المطالبة — سيراجعه فريق التوثيق");
      } else if (result.status === "already_pending") {
        setClaimState("pending");
        toast.info("لديك طلب مطالبة معلّق لهذا العمل");
      } else {
        setClaimState("owner");
        toast.info("أنت مالك هذا العمل بالفعل");
      }
    },
    onError: () => toast.error("تعذّر إرسال المطالبة"),
  });

  const data = query.data;
  const ok = data?.status === "ok" && data.business ? data : null;

  const pins: CadMapPin[] = ok
    ? [
        ...(ok.node?.latitude != null && ok.node?.longitude != null
          ? [
              {
                id: "site",
                latitude: ok.node.latitude,
                longitude: ok.node.longitude,
                label: ok.node.display_name,
                tone: "site" as const,
              },
            ]
          : []),
        ...[ok.visitor_access_point, ok.delivery_access_point]
          .filter((ap): ap is NonNullable<typeof ap> => Boolean(ap))
          .map((ap, index) => ({
            id: ap.id,
            latitude: ap.latitude ?? ok.node?.latitude ?? 0,
            longitude: ap.longitude ?? ok.node?.longitude ?? 0,
            label: ap.display_name,
            tone: (index === 0 ? "recommended" : "alternative") as "recommended" | "alternative",
          })),
      ]
    : [];

  const center = {
    latitude: ok?.visitor_access_point?.latitude ?? ok?.node?.latitude ?? 33.5138,
    longitude: ok?.visitor_access_point?.longitude ?? ok?.node?.longitude ?? 36.2765,
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {query.isPending ? (
          <p className="py-16 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : null}

        {data?.status === "not_found" ? (
          <section className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="font-bold">هذا العمل غير منشور أو غير موجود</p>
            <Link to="/search" className="mt-3 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              البحث في الشبكة
            </Link>
          </section>
        ) : null}

        {ok ? (
          <>
            <section className="animate-entrance rounded-2xl border border-border bg-surface p-5 shadow-plate">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                    <Store className="size-3" />
                    {ok.business!.category ?? "عمل"}
                  </span>
                  <h1 className="mt-1 text-2xl font-bold leading-tight">{ok.business!.name_ar}</h1>
                  {ok.business!.name_en ? (
                    <p className="mt-0.5 text-sm text-muted-foreground" dir="ltr">
                      {ok.business!.name_en}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold ${
                    ok.business!.verification_level === "unverified"
                      ? "bg-secondary text-muted-foreground"
                      : "bg-allow-surface text-allow"
                  }`}
                >
                  <BadgeCheck className="size-3" />
                  {VERIFICATION_LEVELS[ok.business!.verification_level]?.ar ?? "غير موثق"}
                </span>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPinIcon className="size-4 shrink-0" />
                {[ok.node?.neighborhood, ok.node?.city, ok.node?.governorate].filter(Boolean).join(" — ")}
                {ok.node?.landmark ? ` · ${ok.node.landmark}` : ""}
              </p>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {ok.business!.opening_hours ? (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> {ok.business!.opening_hours}
                  </span>
                ) : null}
                {ok.business!.phone ? (
                  <a href={`tel:${ok.business!.phone}`} className="flex items-center gap-1 font-mono" dir="ltr">
                    <Phone className="size-3.5" /> {ok.business!.phone}
                  </a>
                ) : null}
                {ok.business!.website ? (
                  <a
                    href={ok.business!.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-primary"
                  >
                    <Globe className="size-3.5" /> الموقع الإلكتروني
                  </a>
                ) : null}
              </div>

              {ok.smart_code ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                  <span className="font-mono text-lg font-bold" dir="ltr">
                    {ok.smart_code}
                  </span>
                  <div className="ms-auto flex gap-2">
                    <Link
                      to="/"
                      search={{ code: ok.smart_code }}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                    >
                      حلّل الوصول
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowQr(true)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold"
                    >
                      <QrCode className="size-3.5" />
                      بطاقة QR
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="animate-entrance">
              <CadastralMap center={center} pins={pins} />
            </section>

            {[
              { ap: ok.visitor_access_point, label: "مدخل الزوار", icon: Users },
              { ap: ok.delivery_access_point, label: "مدخل التوصيل", icon: Bike },
            ]
              .filter((entry) => entry.ap)
              .map(({ ap, label, icon: Icon }) => (
                <section
                  key={label}
                  className="animate-entrance rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-sm font-bold">
                      <Icon className="size-4 text-primary" />
                      {label}: {ap!.display_name}
                    </h2>
                    <a
                      href={osmDirectionsUrl(ap!.latitude ?? center.latitude, ap!.longitude ?? center.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold"
                    >
                      <Navigation className="size-3" /> الاتجاهات
                    </a>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground" dir="ltr">
                    {formatCoords(ap!.latitude, ap!.longitude)}
                  </p>
                  {ap!.instructions_ar ? (
                    <p className="mt-2 rounded-lg border border-border bg-background p-2.5 text-sm">
                      {ap!.instructions_ar}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded-md border border-border px-2 py-0.5 font-mono" dir="ltr">
                      {ap!.always_open
                        ? "24/7"
                        : `${ap!.opens_at?.slice(0, 5) ?? "—"} – ${ap!.closes_at?.slice(0, 5) ?? "—"}`}
                    </span>
                    {ap!.accessibility.map((item) => (
                      <span key={item} className="rounded-md border border-border px-2 py-0.5">
                        {ACCESSIBILITY_LABELS[item] ?? item}
                      </span>
                    ))}
                  </div>
                </section>
              ))}

            <section className="animate-entrance rounded-2xl border border-border bg-surface p-5">
              {claimState === "owner" ? (
                <p className="flex items-center gap-2 text-sm font-bold text-allow">
                  <BadgeCheck className="size-4" /> أنت مالك هذا العمل.
                </p>
              ) : claimState === "pending" ? (
                <p className="text-sm font-bold">طلب المطالبة قيد المراجعة من فريق التوثيق.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-bold">
                        <Handshake className="size-4 text-primary" />
                        هل هذا عملك؟
                      </h2>
                      <p className="mt-1 text-xs text-muted-foreground">
                        المطالبة تمنحك إدارة الملف ومداخله بعد مراجعة بشرية.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (authed === false) {
                          void navigate({ to: "/auth", search: { redirect: `/business/${id}` } });
                          return;
                        }
                        setClaimOpen((v) => !v);
                      }}
                      className="shrink-0 rounded-lg bg-foreground px-4 py-2 text-xs font-bold text-background"
                    >
                      {authed === false ? "سجّل الدخول للمطالبة" : "طالب بالملكية"}
                    </button>
                  </div>
                  {claimOpen ? (
                    <div className="mt-3 rounded-xl border border-border bg-background p-3">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                        إثبات الملكية (اختياري)
                      </label>
                      <textarea
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                        rows={3}
                        maxLength={600}
                        placeholder="مثال: رقم السجل التجاري، هاتف العمل، أو وثيقة إيجار…"
                        className="mt-1 w-full rounded-lg border border-border bg-surface p-2.5 text-sm focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={claimMutation.isPending}
                        onClick={() => claimMutation.mutate()}
                        className="mt-2 w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                      >
                        إرسال طلب المطالبة
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>

            {showQr && ok.smart_code ? (
              <QrCard
                url={`${window.location.origin}/?code=${ok.smart_code}`}
                code={ok.smart_code}
                title={ok.business!.name_ar}
                subtitle={[ok.node?.neighborhood, ok.node?.city].filter(Boolean).join(" — ")}
                onClose={() => setShowQr(false)}
              />
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
