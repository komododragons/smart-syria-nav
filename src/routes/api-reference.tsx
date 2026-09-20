import { createFileRoute, Link } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";

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
  ar: string;
  example: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/v1/addresses",
    scope: "addresses:write",
    ar: "إنشاء عنوان ذكي عام جديد وتوليد رمزه تلقائياً.",
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
    ar: "بيانات العنوان العام الكاملة: الموقع، المدخل، النشاط التجاري، روابط الصفحة وQR.",
    example: `curl https://syriasan.com/api/v1/addresses/SY-DAM-K7X4 \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "GET",
    path: "/api/v1/resolve/{code}",
    scope: "resolve",
    ar: "حلّ حسب الغرض (توصيل، زيارة، إسعاف…) مع المدخل الموصى به والتقييدات.",
    example: `curl "https://syriasan.com/api/v1/resolve/SY-DAM-K7X4?purpose=parcel_delivery&wheelchair=true" \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "GET",
    path: "/api/v1/search",
    scope: "search",
    ar: "بحث في العناوين العامة بالاسم أو المحافظة أو المدينة.",
    example: `curl "https://syriasan.com/api/v1/search?q=برج&governorate=دمشق&limit=10" \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "POST",
    path: "/api/v1/validate",
    scope: "validate",
    ar: "التحقق من صيغة الرمز ووجوده وكون الإحداثيات داخل سوريا، مع درجة اكتمال.",
    example: `curl -X POST https://syriasan.com/api/v1/validate \\
  -H "x-api-key: san_live_…" -H "Content-Type: application/json" \\
  -d '{"code":"SY-DAM-K7X4","latitude":33.51,"longitude":36.27}'`,
  },
  {
    method: "POST",
    path: "/api/v1/geocode",
    scope: "geocode",
    ar: "تحويل نص إلى إحداثيات: نتائج سيرياسان أولاً ثم OpenStreetMap داخل سوريا.",
    example: `curl -X POST https://syriasan.com/api/v1/geocode \\
  -H "x-api-key: san_live_…" -H "Content-Type: application/json" \\
  -d '{"query":"المزة أوتوستراد","lang":"ar"}'`,
  },
  {
    method: "POST",
    path: "/api/v1/reverse-geocode",
    scope: "geocode",
    ar: "أقرب العناوين الذكية العامة لنقطة، مع وصف المكان من OpenStreetMap.",
    example: `curl -X POST https://syriasan.com/api/v1/reverse-geocode \\
  -H "x-api-key: san_live_…" -H "Content-Type: application/json" \\
  -d '{"latitude":33.5138,"longitude":36.2765,"radius_m":300}'`,
  },
  {
    method: "GET",
    path: "/api/v1/qr/{code}",
    scope: "qr",
    ar: "رمز QR للعنوان: JSON افتراضياً أو صورة SVG عبر format=svg.",
    example: `curl "https://syriasan.com/api/v1/qr/SY-DAM-K7X4?format=svg&size=640" \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "GET",
    path: "/api/v1/route",
    scope: "route",
    ar: "مسار حتى المدخل المناسب — وليس مركز المبنى — بالسيارة أو مشياً أو بالدراجة.",
    example: `curl "https://syriasan.com/api/v1/route?from=33.50,36.29&to=SY-DAM-K7X4&mode=driving" \\
  -H "x-api-key: san_live_…"`,
  },
  {
    method: "POST",
    path: "/api/v1/keys/revoke",
    scope: "keys:manage",
    ar: "إلغاء أحد مفاتيح حسابك فوراً باستخدام بادئة المفتاح.",
    example: `curl -X POST https://syriasan.com/api/v1/keys/revoke \\
  -H "x-api-key: san_live_…" -H "Content-Type: application/json" \\
  -d '{"key_prefix":"san_live_9fA2xQ1"}'`,
  },
];

function ApiReference() {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <header>
          <h1 className="text-lg font-bold">واجهة سيرياسان البرمجية — الإصدار v1</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            واجهة REST رسمية لشركاء التوصيل والمتاجر وتطبيقات الخرائط. كل طلب يحتاج مفتاحاً صالحاً،
            ويُحتسب ضمن حدّ المعدل، ويُسجَّل في تقرير الاستهلاك.
          </p>
          <Link
            to="/developers"
            className="mt-3 inline-flex rounded-lg border border-primary/50 px-3 py-2 text-xs font-bold text-primary"
          >
            إدارة مفاتيح API
          </Link>
        </header>

        <section className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            المصادقة والحدود
          </h2>
          <ul className="mt-2 list-disc space-y-1 pe-5 text-[13px] text-muted-foreground">
            <li>
              أرسل المفتاح في <code dir="ltr">Authorization: Bearer san_live_…</code> أو{" "}
              <code dir="ltr">x-api-key</code>.
            </li>
            <li>تُخزَّن المفاتيح مُجزّأة (SHA-256) فقط — لا يمكن استرجاع المفتاح بعد إنشائه.</li>
            <li>
              لكل حساب حدّ افتراضي للمعدل بالدقيقة، وتعود الترويسات{" "}
              <code dir="ltr">X-RateLimit-Limit</code> و<code dir="ltr">X-RateLimit-Remaining</code>،
              وعند التجاوز يعود <code dir="ltr">429</code>.
            </li>
            <li>الصلاحيات تُمنح لكل حساب ولكل مفتاح؛ نقص الصلاحية يعيد <code dir="ltr">403</code>.</li>
            <li>يمكن إلغاء أي مفتاح فوراً، وكل إنشاء أو إلغاء يُسجَّل في سجل التدقيق.</li>
          </ul>
          <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-[12px]">
            الخصوصية غير قابلة للتفاوض: العناوين السكنية الخاصة لا تُكشف أبداً عبر هذه الواجهة —
            تعيد <code dir="ltr">403 private</code> بلا أي تفاصيل. لمشاركة عنوان خاص مؤقتاً استخدم
            رابط المشاركة المؤقت الذي ينشئه صاحب العنوان.
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
            <p className="mt-2 text-[13px] text-muted-foreground">{ep.ar}</p>
            <pre
              dir="ltr"
              className="mt-2 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed"
            >
              {ep.example}
            </pre>
          </section>
        ))}

        <p className="pb-6 text-[11px] text-muted-foreground">
          العنوان البديل <code dir="ltr">/api/public/v1/…</code> يعمل بنفس الطريقة تماماً.
        </p>
      </main>
    </div>
  );
}
