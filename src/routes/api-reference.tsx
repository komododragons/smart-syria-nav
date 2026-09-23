import { createFileRoute, Link } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { useI18n, type Bilingual } from "@/lib/i18n";

export const Route = createFileRoute("/api-reference")({
  head: () => ({
    meta: [
      { title: "مرجع واجهة سيرياسان البرمجية v1 | Syriasan API v1" },
      {
        name: "description",
        content:
          "توثيق واجهة سيرياسان البرمجية v1: المصادقة بمفاتيح مُجزّأة، الصلاحيات، حدود المعدل، وإنشاء العناوين الذكية وحلّها والبحث والتوجيه ورموز QR.",
      },
      { property: "og:title", content: "مرجع واجهة سيرياسان البرمجية v1" },
      {
        property: "og:description",
        content:
          "نقاط النهاية الرسمية لشبكة العنوان الذكي السوري: العناوين، الحلّ، البحث، التحقق، الترميز الجغرافي، المسارات، QR.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiReference,
});

type Endpoint = {
  method: "GET" | "POST";
  path: string;
  scope: string;
  desc: Bilingual;
  example: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/v1/addresses",
    scope: "addresses:write",
    desc: { ar: "إنشاء عنوان ذكي عام جديد وتوليد رمزه تلقائياً.", en: "Create a new public smart address and auto-generate its code." },
    example: `curl -X POST https://syriasan.com/api/v1/addresses \\
  -H "Authorization: Bearer san_live_…" \\
  -H "Content-Type: application/json" \\
  -d '{"name_ar":"فرع المزة","governorate":"دمشق","governorate_code":"DAM",
       "city":"دمشق","street":"أوتوستراد المزة","latitude":33.5138,"longitude":36.2765,
       "entrance_name":"المدخل الرئيسي","entrance_instructions":"يمين المبنى"}'`,
  },
  {
    method: "GET",
    path: "/api/v1/addresses/{code}",
    scope: "addresses:read",
    desc: { ar: "بيانات العنوان العام الكاملة: الموقع، المدخل، النشاط التجاري، روابط الصفحة وQR.", en: "Full public address data: location, entrance, business info, page and QR links." },
    example: `curl https://syriasan.com/api/v1/addresses/SY-DAM-K7X4 \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "GET",
    path: "/api/v1/resolve/{code}",
    scope: "resolve",
    desc: { ar: "حلّ حسب الغرض (توصيل، زيارة، إسعاف…) مع المدخل الموصى به والتقييدات.", en: "Purpose-based resolution (delivery, visit, ambulance…) with the recommended entrance and restrictions." },
    example: `curl "https://syriasan.com/api/v1/resolve/SY-DAM-K7X4?purpose=parcel_delivery&wheelchair=true" \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "GET",
    path: "/api/v1/search",
    scope: "search",
    desc: { ar: "بحث في العناوين العامة بالاسم أو المحافظة أو المدينة.", en: "Search public addresses by name, governorate or city." },
    example: `curl "https://syriasan.com/api/v1/search?q=برج&governorate=دمشق&limit=10" \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "POST",
    path: "/api/v1/validate",
    scope: "validate",
    desc: { ar: "التحقق من صيغة الرمز ووجوده وكون الإحداثيات داخل سوريا، مع درجة اكتمال.", en: "Validates the code's format and existence, and that the coordinates fall inside Syria, with a completeness score." },
    example: `curl -X POST https://syriasan.com/api/v1/validate \\
  -H "x-api-key: san_live_…" -H "Content-Type: application/json" \\
  -d '{"code":"SY-DAM-K7X4","latitude":33.51,"longitude":36.27}'`,
  },
  {
    method: "POST",
    path: "/api/v1/geocode",
    scope: "geocode",
    desc: { ar: "تحويل نص إلى إحداثيات: نتائج سيرياسان أولاً ثم OpenStreetMap داخل سوريا.", en: "Converts free text to coordinates: Syriasan results first, then OpenStreetMap within Syria." },
    example: `curl -X POST https://syriasan.com/api/v1/geocode \\
  -H "x-api-key: san_live_…" -H "Content-Type: application/json" \\
  -d '{"query":"المزة أوتوستراد","lang":"ar"}'`,
  },
  {
    method: "POST",
    path: "/api/v1/reverse-geocode",
    scope: "geocode",
    desc: { ar: "أقرب العناوين الذكية العامة لنقطة، مع وصف المكان من OpenStreetMap.", en: "The nearest public smart addresses to a point, with a place description from OpenStreetMap." },
    example: `curl -X POST https://syriasan.com/api/v1/reverse-geocode \\
  -H "x-api-key: san_live_…" -H "Content-Type: application/json" \\
  -d '{"latitude":33.5138,"longitude":36.2765,"radius_m":300}'`,
  },
  {
    method: "GET",
    path: "/api/v1/qr/{code}",
    scope: "qr",
    desc: { ar: "رمز QR للعنوان: JSON افتراضياً أو صورة SVG عبر format=svg.", en: "QR code for the address: JSON by default, or an SVG image via format=svg." },
    example: `curl "https://syriasan.com/api/v1/qr/SY-DAM-K7X4?format=svg&size=640" \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "GET",
    path: "/api/v1/route",
    scope: "route",
    desc: { ar: "مسار حتى المدخل المناسب — وليس مركز المبنى — بالسيارة أو مشياً أو بالدراجة.", en: "Route to the correct entrance — not the building's centroid — by car, on foot or by bike." },
    example: `curl "https://syriasan.com/api/v1/route?from=33.50,36.29&to=SY-DAM-K7X4&mode=driving" \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "GET",
    path: "/api/v1/capabilities",
    scope: "addresses:read",
    desc: { ar: "عقد تكامل محايد يعلن القطاعات والقدرات وسياقات المداخل وحدود الخصوصية، دون ادعاء وجود موصلات حية.", en: "A provider-neutral contract describing sectors, capabilities, entrance contexts and privacy boundaries, without claiming live connectors." },
    example: `curl https://syriasan.com/api/v1/capabilities \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "POST",
    path: "/api/v1/events",
    scope: "events:write",
    desc: { ar: "تسجيل استخدام عنوان أو بدء توجيه أو وصول ناجح مع مفتاح منع تكرار ومعرّف رحلة؛ يقبل العناوين العامة فقط.", en: "Record address use, navigation start or successful arrival with idempotency and journey correlation; public addresses only." },
    example: `curl -X POST https://syriasan.com/api/v1/events \\
  -H "x-api-key: san_live_…" -H "Content-Type: application/json" \\
  -d '{"code":"SY-DAM-K7X4","event":"destination_reached","correlation_id":"550e8400-e29b-41d4-a716-446655440000","idempotency_key":"order-784-arrived","routing_context":"parcel"}'`,
  },
  {
    method: "POST",
    path: "/api/v1/keys/revoke",
    scope: "keys:manage",
    desc: { ar: "إلغاء أحد مفاتيح حسابك فوراً باستخدام بادئة المفتاح.", en: "Instantly revoke one of your account's keys using its key prefix." },
    example: `curl -X POST https://syriasan.com/api/v1/keys/revoke \\
  -H "x-api-key: san_live_…" -H "Content-Type: application/json" \\
  -d '{"key_prefix":"san_live_9fA2xQ1"}'`,
  },
];

function ApiReference() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <header>
          <h1 className="text-lg font-bold">{t({ ar: "واجهة سيرياسان البرمجية — الإصدار v1", en: "Syriasan API — version v1" })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t({
              ar: "واجهة REST رسمية لشركاء التوصيل والمتاجر وتطبيقات الخرائط. كل طلب يحتاج مفتاحاً صالحاً، ويُحتسب ضمن حدّ المعدل، ويُسجَّل في تقرير الاستهلاك.",
              en: "The official REST API for delivery partners, stores and mapping apps. Every request needs a valid key, counts toward the rate limit, and is logged in the usage report.",
            })}
          </p>
          <Link
            to="/developers"
            className="mt-3 inline-flex rounded-lg border border-primary/50 px-3 py-2 text-xs font-bold text-primary"
          >
            {t({ ar: "إدارة مفاتيح API", en: "Manage API keys" })}
          </Link>
        </header>

        <section className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t({ ar: "المصادقة والحدود", en: "Authentication & limits" })}
          </h2>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-[13px] text-muted-foreground">
            <li>
              {t({ ar: "أرسل المفتاح في", en: "Send the key in" })} <code dir="ltr">Authorization: Bearer san_live_…</code>{" "}
              {t({ ar: "أو", en: "or" })} <code dir="ltr">x-api-key</code>.
            </li>
            <li>{t({ ar: "تُخزَّن المفاتيح مُجزّأة (SHA-256) فقط — لا يمكن استرجاع المفتاح بعد إنشائه.", en: "Keys are stored hashed (SHA-256) only — a key can never be retrieved after creation." })}</li>
            <li>
              {t({ ar: "لكل حساب حدّ افتراضي للمعدل بالدقيقة، وتعود الترويسات", en: "Each account has a default per-minute rate limit, and responses carry the" })}{" "}
              <code dir="ltr">X-RateLimit-Limit</code> {t({ ar: "و", en: "and" })}
              <code dir="ltr">X-RateLimit-Remaining</code>
              {t({ ar: "، وعند التجاوز يعود", en: " headers; exceeding it returns" })} <code dir="ltr">429</code>.
            </li>
            <li>
              {t({ ar: "الصلاحيات تُمنح لكل حساب ولكل مفتاح؛ نقص الصلاحية يعيد", en: "Scopes are granted per account and per key; a missing scope returns" })}{" "}
              <code dir="ltr">403</code>.
            </li>
            <li>{t({ ar: "يمكن إلغاء أي مفتاح فوراً، وكل إنشاء أو إلغاء يُسجَّل في سجل التدقيق.", en: "Any key can be revoked instantly, and every creation or revocation is logged in the audit trail." })}</li>
          </ul>
          <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-[12px]">
            {t({ ar: "الخصوصية غير قابلة للتفاوض: العناوين السكنية الخاصة لا تُكشف أبداً عبر هذه الواجهة —", en: "Privacy is non-negotiable: private residential addresses are never exposed through this API —" })}
            {" "}
            {t({ ar: "تعيد", en: "it returns" })} <code dir="ltr">403 private</code>{" "}
            {t({ ar: "بلا أي تفاصيل. لمشاركة عنوان خاص مؤقتاً استخدم رابط المشاركة المؤقت الذي ينشئه صاحب العنوان.", en: "with no details at all. To share a private address temporarily, use the temporary share link the address owner creates." })}
          </p>
        </section>

        {ENDPOINTS.map((ep) => (
          <section key={ep.path + ep.method} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
                  ep.method === "GET" ? "bg-primary/15 text-primary" : "bg-accent/20 text-accent-foreground"
                }`}
              >
                {ep.method}
              </span>
              <code dir="ltr" className="font-mono text-[12px] font-bold">
                {ep.path}
              </code>
              <span className="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {ep.scope}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">{t(ep.desc)}</p>
            <pre
              dir="ltr"
              className="mt-2 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed"
            >
              {ep.example}
            </pre>
          </section>
        ))}

        <p className="pb-6 text-[11px] text-muted-foreground">
          {t({ ar: "العنوان البديل", en: "The alternate base URL" })} <code dir="ltr">/api/public/v1/…</code>{" "}
          {t({ ar: "يعمل بنفس الطريقة تماماً.", en: "works exactly the same way." })}
        </p>
      </main>
    </div>
  );
}
