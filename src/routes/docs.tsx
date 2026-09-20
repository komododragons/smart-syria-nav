import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { CodeTabs, type CodeSamples } from "@/components/CodeTabs";
import { useI18n, type Bilingual } from "@/lib/i18n";

export const Route = createFileRoute("/docs")({
  head: () => ({
    meta: [
      { title: "بوابة المطورين — سيرياسان | Syriasan Developer Portal" },
      {
        name: "description",
        content:
          "بوابة مطوري سيرياسان: المصادقة، حلّ العنوان، التحقق، البحث، إنشاء العنوان، QR، التوجيه، Webhooks، الأخطاء، حدود المعدل، والخصوصية — مع أمثلة cURL وJavaScript وTypeScript ووضع اختبار.",
      },
      { property: "og:title", content: "بوابة مطوري سيرياسان" },
      {
        property: "og:description",
        content:
          "توثيق كامل لواجهة سيرياسان البرمجية v1 مع أمثلة جاهزة للنسخ ووحدة اختبار حية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeveloperPortal,
});

const BASE = "https://syriasan.com/api/v1";

function samples(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): CodeSamples {
  const payload = body ? JSON.stringify(body, null, 2) : null;
  const curl = body
    ? `curl -X POST ${BASE}${path} \\
  -H "Authorization: Bearer $SYRIASAN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body)}'`
    : `curl "${BASE}${path}" \\
  -H "Authorization: Bearer $SYRIASAN_KEY"`;

  const js = `const res = await fetch("${BASE}${path}", {
  method: "${method}",${
    payload
      ? `
  headers: {
    Authorization: \`Bearer \${process.env.SYRIASAN_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${payload.split("\n").join("\n  ")}),`
      : `
  headers: { Authorization: \`Bearer \${process.env.SYRIASAN_KEY}\` },`
  }
});
const data = await res.json();
console.log(data);`;

  const ts = `import type { SyriasanAddress } from "./syriasan-types";

const res = await fetch("${BASE}${path}", {
  method: "${method}",${
    payload
      ? `
  headers: {
    Authorization: \`Bearer \${process.env.SYRIASAN_KEY!}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(${payload.split("\n").join("\n  ")}),`
      : `
  headers: { Authorization: \`Bearer \${process.env.SYRIASAN_KEY!}\` },`
  }
});
if (!res.ok) throw new Error(\`Syriasan \${res.status}: \${(await res.json()).error}\`);
const data = (await res.json()) as SyriasanAddress;`;

  return { curl, javascript: js, typescript: ts };
}

type Section = {
  id: string;
  title: Bilingual;
  intro: Bilingual;
  bullets?: Bilingual[];
  samples?: CodeSamples;
  note?: Bilingual;
};

const SECTIONS: Section[] = [
  {
    id: "auth",
    title: { ar: "المصادقة", en: "Authentication" },
    intro: {
      ar: "كل طلب يحتاج مفتاح API صالحاً. أرسله في ترويسة Authorization: Bearer أو x-api-key. تُخزَّن المفاتيح مُجزّأة (SHA-256) فقط ولا يمكن استرجاعها بعد إنشائها — احفظ المفتاح لحظة إنشائه.",
      en: "Every request needs a valid API key. Send it in the Authorization: Bearer header or x-api-key. Keys are stored hashed (SHA-256) only and can never be retrieved after creation — save the key the moment it's generated.",
    },
    bullets: [
      {
        ar: "أنشئ حساب مطوّر ومفتاحاً من صفحة «واجهة المطورين».",
        en: "Create a developer account and a key from the “Developers” page.",
      },
      {
        ar: "لا تضع المفتاح في كود المتصفح؛ استدعِ الواجهة من خادمك.",
        en: "Never put the key in browser-side code; call the API from your server.",
      },
      {
        ar: "يمكن إلغاء أي مفتاح فوراً، وكل إنشاء أو إلغاء يُسجَّل في سجل التدقيق.",
        en: "Any key can be revoked instantly, and every creation or revocation is logged in the audit trail.",
      },
    ],
    samples: {
      curl: `curl "${BASE}/resolve/SY-DAM-K7X4" \\
  -H "Authorization: Bearer san_live_…"

# equivalent alternative
curl "${BASE}/resolve/SY-DAM-K7X4" -H "x-api-key: san_live_…"`,
      javascript: `const syriasan = (path, init = {}) =>
  fetch(\`${BASE}\${path}\`, {
    ...init,
    headers: {
      Authorization: \`Bearer \${process.env.SYRIASAN_KEY}\`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  }).then((r) => r.json());

const address = await syriasan("/resolve/SY-DAM-K7X4");`,
      typescript: `export async function syriasan<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(\`${BASE}\${path}\`, {
    ...init,
    headers: {
      Authorization: \`Bearer \${process.env.SYRIASAN_KEY!}\`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(\`Syriasan \${res.status}\`);
  return (await res.json()) as T;
}`,
    },
  },
  {
    id: "sandbox",
    title: { ar: "وضع الاختبار (Sandbox)", en: "Sandbox mode" },
    intro: {
      ar: "أنشئ حساب مطوّر من نوع «تجريبي» واستخدم مفاتيحه للتطوير. في وضع الاختبار تعمل عمليات القراءة على بيانات حقيقية عامة، بينما تُحاكى عمليات الكتابة: يُتحقَّق من الحقول ويعود ردّ 201 بالرمز SY-XXX-TEST دون حفظ أي شيء.",
      en: "Create a “test” developer account and use its keys during development. In sandbox mode, reads run against real public data, while writes are simulated: fields are validated and a 201 response comes back with the code SY-XXX-TEST without anything being saved.",
    },
    bullets: [
      {
        ar: "كل ردّ يحمل الترويسة X-Syriasan-Mode بقيمة test أو live.",
        en: "Every response carries an X-Syriasan-Mode header set to test or live.",
      },
      {
        ar: "ردود المحاكاة تتضمن \"mode\": \"test\" و\"status\": \"simulated\".",
        en: "Simulated responses include \"mode\": \"test\" and \"status\": \"simulated\".",
      },
      {
        ar: "الرمز التجريبي للتجارب: SY-DAM-K7X4.",
        en: "The sample code to experiment with: SY-DAM-K7X4.",
      },
    ],
    samples: samples("POST", "/addresses", {
      name_ar: "فرع تجريبي",
      governorate: "دمشق",
      governorate_code: "DAM",
      city: "دمشق",
      latitude: 33.5138,
      longitude: 36.2765,
    }),
  },
  {
    id: "resolve",
    title: { ar: "حلّ العنوان — Resolve", en: "Resolve address" },
    intro: {
      ar: "GET /resolve/{code} يعيد المدخل الموصى به حسب الغرض (توصيل طرد، طعام، زيارة، إسعاف، شاحنة…) مع الإحداثيات والتعليمات والقيود. هذه هي النقطة التي تستخدمها تطبيقات التوصيل.",
      en: "GET /resolve/{code} returns the entrance recommended for the given purpose (parcel delivery, food, visit, ambulance, truck…) with coordinates, instructions and restrictions. This is the endpoint delivery apps use.",
    },
    samples: samples("GET", "/resolve/SY-DAM-K7X4?purpose=parcel_delivery&wheelchair=true"),
    note: {
      ar: "المدخل المعاد هو نقطة الوصول الفعلية وليس مركز المبنى.",
      en: "The entrance returned is the real access point, not the building's centroid.",
    },
  },
  {
    id: "validate",
    title: { ar: "التحقق — Validate", en: "Validate" },
    intro: {
      ar: "POST /validate يتحقق من صيغة الرمز ووجوده، ومن وقوع الإحداثيات داخل سوريا، ويعيد درجة اكتمال للعنوان — مناسب لحقول الدفع والتسجيل.",
      en: "POST /validate checks the code's format and existence, confirms the coordinates fall inside Syria, and returns a completeness score for the address — ideal for checkout and signup fields.",
    },
    samples: samples("POST", "/validate", {
      code: "SY-DAM-K7X4",
      latitude: 33.5138,
      longitude: 36.2765,
    }),
  },
  {
    id: "search",
    title: { ar: "البحث — Search", en: "Search" },
    intro: {
      ar: "GET /search يبحث في العناوين العامة فقط بالاسم أو الشارع، مع تصفية بالمحافظة والمدينة وحدّ أقصى 50 نتيجة.",
      en: "GET /search searches public addresses only by name or street, filterable by governorate and city, capped at 50 results.",
    },
    samples: samples("GET", "/search?q=mazzeh&governorate=دمشق&limit=10"),
  },
  {
    id: "create",
    title: { ar: "إنشاء عنوان — Create Address", en: "Create address" },
    intro: {
      ar: "POST /addresses ينشئ عنواناً عاماً جديداً ويولّد رمزه الذكي تلقائياً. يتطلب صلاحية addresses:write، وينشئ عناوين عامة فقط — لا يمكن إنشاء عناوين سكنية خاصة عبر الواجهة.",
      en: "POST /addresses creates a new public address and generates its smart code automatically. It requires the addresses:write scope and only creates public addresses — private residential addresses can't be created through the API.",
    },
    samples: samples("POST", "/addresses", {
      name_ar: "مقهى الياسمين",
      governorate: "دمشق",
      governorate_code: "DAM",
      city: "دمشق",
      street: "شارع الحمرا",
      latitude: 33.5138,
      longitude: 36.2765,
      entrance_name: "المدخل الرئيسي",
      entrance_instructions: "يمين البناء بعد الصيدلية",
      phone: "+963…",
      category: "cafe",
    }),
  },
  {
    id: "qr",
    title: { ar: "رموز QR", en: "QR codes" },
    intro: {
      ar: "GET /qr/{code} يعيد بيانات الرمز بصيغة JSON، أو صورة SVG جاهزة للطباعة عند تمرير format=svg مع مقاس بين 128 و2048 بكسل.",
      en: "GET /qr/{code} returns the code's data as JSON, or a print-ready SVG image when format=svg is passed, with a size between 128 and 2048 pixels.",
    },
    samples: samples("GET", "/qr/SY-DAM-K7X4?format=svg&size=640"),
    note: {
      ar: "يفتح المسح صفحة العنوان العامة /a/CODE، ولا يكشف أبداً بيانات خاصة.",
      en: "Scanning opens the public address page /a/CODE and never exposes private data.",
    },
  },
  {
    id: "navigation",
    title: { ar: "التوجيه — Navigation", en: "Navigation" },
    intro: {
      ar: "GET /route يحسب المسار من نقطة انطلاق حتى المدخل المناسب للعنوان، بالسيارة أو مشياً أو بالدراجة، ويعيد المسافة والزمن وهندسة المسار.",
      en: "GET /route calculates the path from a starting point to the address's correct entrance, by car, on foot or by bike, and returns the distance, duration and route geometry.",
    },
    samples: samples("GET", "/route?from=33.5020,36.2900&to=SY-DAM-K7X4&mode=driving"),
    note: {
      ar: "الوجهة دائماً المدخل المختار، لا مركز المبنى. عند تعذّر خدمة المسارات يعود مسار تقريبي مع degraded: true.",
      en: "The destination is always the chosen entrance, never the building's centroid. If the routing service is unavailable, an approximate route is returned with degraded: true.",
    },
  },
  {
    id: "webhooks",
    title: { ar: "Webhooks", en: "Webhooks" },
    intro: {
      ar: "سجّل رابط HTTPS ليصلك إشعار فوري عند وقوع الأحداث: address.created، address.resolved، address.navigation_started، address.delivery_viewed، address.qr_scanned. يُعاد السر مرة واحدة فقط عند الإنشاء.",
      en: "Register an HTTPS URL to receive an instant notification when events occur: address.created, address.resolved, address.navigation_started, address.delivery_viewed, address.qr_scanned. The secret is returned only once, at creation.",
    },
    bullets: [
      { ar: "POST /webhooks — إنشاء اشتراك (url + events).", en: "POST /webhooks — create a subscription (url + events)." },
      {
        ar: "GET /webhooks — عرض الاشتراكات وعدّادات التسليم والإخفاق.",
        en: "GET /webhooks — view subscriptions along with delivery and failure counters.",
      },
      { ar: "POST /webhooks/test — إرسال تسليم تجريبي.", en: "POST /webhooks/test — send a test delivery." },
      { ar: "POST /webhooks/delete — حذف اشتراك.", en: "POST /webhooks/delete — delete a subscription." },
      {
        ar: "كل تسليم يحمل X-Syriasan-Event وX-Syriasan-Timestamp وX-Syriasan-Signature.",
        en: "Every delivery carries X-Syriasan-Event, X-Syriasan-Timestamp and X-Syriasan-Signature.",
      },
    ],
    samples: {
      curl: `curl -X POST ${BASE}/webhooks \\
  -H "Authorization: Bearer $SYRIASAN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com/hooks/syriasan","events":["address.resolved","address.delivery_viewed"]}'`,
      javascript: `// verify the signature before trusting any payload
import crypto from "node:crypto";

export function verifySyriasan(req, secret) {
  const timestamp = req.headers["x-syriasan-timestamp"];
  const signature = req.headers["x-syriasan-signature"];
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(\`\${timestamp}.\${req.rawBody}\`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}`,
      typescript: `import crypto from "node:crypto";

type SyriasanEvent = {
  event:
    | "address.created"
    | "address.resolved"
    | "address.navigation_started"
    | "address.delivery_viewed"
    | "address.qr_scanned";
  created_at: string;
  data: { code: string; source: string | null };
};

export function parseSyriasanEvent(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
): SyriasanEvent {
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", secret)
      .update(\`\${headers["x-syriasan-timestamp"]}.\${rawBody}\`)
      .digest("hex");
  if (headers["x-syriasan-signature"] !== expected) throw new Error("bad signature");
  return JSON.parse(rawBody) as SyriasanEvent;
}`,
    },
    note: {
      ar: "التوقيع يُحسب على النص «الطابع الزمني.الجسم الخام» بخوارزمية HMAC-SHA256. ارفض أي طابع زمني أقدم من خمس دقائق.",
      en: "The signature is computed over the string “timestamp.raw_body” using HMAC-SHA256. Reject any timestamp older than five minutes.",
    },
  },
  {
    id: "errors",
    title: { ar: "الأخطاء", en: "Errors" },
    intro: {
      ar: "كل خطأ يعود بصيغة JSON موحّدة: {\"error\":\"رمز_الخطأ\",\"message\":\"شرح\"} مع رمز HTTP مناسب.",
      en: "Every error comes back in a consistent JSON shape: {\"error\":\"error_code\",\"message\":\"explanation\"} with an appropriate HTTP status code.",
    },
    bullets: [
      { ar: "400 invalid_request — حقول ناقصة أو غير صالحة.", en: "400 invalid_request — missing or invalid fields." },
      {
        ar: "401 missing_api_key / invalid_api_key / revoked_api_key / expired_api_key.",
        en: "401 missing_api_key / invalid_api_key / revoked_api_key / expired_api_key.",
      },
      {
        ar: "403 insufficient_scope — المفتاح لا يملك الصلاحية المطلوبة.",
        en: "403 insufficient_scope — the key doesn't have the required scope.",
      },
      { ar: "403 private — العنوان سكني خاص ولن يُكشف.", en: "403 private — the address is private residential and won't be disclosed." },
      { ar: "403 inactive_client — حساب المطوّر موقوف.", en: "403 inactive_client — the developer account is suspended." },
      { ar: "404 not_found / unknown_endpoint.", en: "404 not_found / unknown_endpoint." },
      {
        ar: "422 out_of_bounds / no_coordinates — إحداثيات خارج سوريا أو مدخل بلا إحداثيات.",
        en: "422 out_of_bounds / no_coordinates — coordinates outside Syria or an entrance without coordinates.",
      },
      { ar: "429 rate_limited — تجاوز حدّ المعدل.", en: "429 rate_limited — rate limit exceeded." },
    ],
  },
  {
    id: "limits",
    title: { ar: "حدود المعدل", en: "Rate limits" },
    intro: {
      ar: "لكل حساب مطوّر حدّ طلبات بالدقيقة (٦٠ افتراضياً، قابل للرفع). كل ردّ يحمل X-RateLimit-Limit وX-RateLimit-Remaining، وعند التجاوز يعود 429 مع Retry-After: 60.",
      en: "Every developer account has a requests-per-minute limit (60 by default, can be raised). Every response carries X-RateLimit-Limit and X-RateLimit-Remaining, and exceeding it returns 429 with Retry-After: 60.",
    },
    bullets: [
      { ar: "راقب الترويسات وطبّق إعادة محاولة تصاعدية عند 429.", en: "Watch the headers and apply exponential backoff on 429." },
      {
        ar: "خزّن نتائج الحلّ مؤقتاً لبضع دقائق لتقليل الاستهلاك.",
        en: "Cache resolve results for a few minutes to reduce usage.",
      },
      {
        ar: "كل طلب يُسجَّل في تقرير الاستهلاك مع النقطة والحالة وزمن الاستجابة.",
        en: "Every request is logged in the usage report along with the endpoint, status and response time.",
      },
    ],
  },
  {
    id: "privacy",
    title: { ar: "الخصوصية", en: "Privacy" },
    intro: {
      ar: "الخصوصية غير قابلة للتفاوض. العناوين السكنية خاصة افتراضياً ولا تظهر في الواجهة إطلاقاً: يعود 403 private دون أي تسلسل أو إحداثيات أو بيانات مالك.",
      en: "Privacy is non-negotiable. Residential addresses are private by default and never appear through the API: a 403 private response comes back with no sequence, coordinates, or owner data.",
    },
    bullets: [
      {
        ar: "لا تُعاد أسماء أو هواتف السكان؛ الهواتف العامة للأنشطة التجارية المنشورة فقط.",
        en: "No resident names or phone numbers are ever returned; only published business phone numbers are public.",
      },
      {
        ar: "الطابق والشقة يظهران فقط عبر رابط مشاركة مؤقت ينشئه صاحب العنوان.",
        en: "Floor and apartment details only appear through a temporary share link the address owner creates.",
      },
      {
        ar: "الروابط المؤقتة لا تجعل البيانات قابلة للبحث، وتنتهي أو تُلغى فوراً.",
        en: "Temporary links never make the data searchable, and they expire or can be revoked instantly.",
      },
      {
        ar: "لا تخزّن بيانات عنوان أكثر مما تحتاجه لإتمام الطلب.",
        en: "Don't store more address data than you need to complete the order.",
      },
    ],
  },
];

const SANDBOX_REQUESTS = [
  { label: "GET /resolve/SY-DAM-K7X4", method: "GET" as const, path: "/resolve/SY-DAM-K7X4" },
  { label: "GET /addresses/SY-DAM-K7X4", method: "GET" as const, path: "/addresses/SY-DAM-K7X4" },
  { label: "GET /search?q=mazzeh", method: "GET" as const, path: "/search?q=mazzeh&limit=5" },
  { label: "GET /qr/SY-DAM-K7X4", method: "GET" as const, path: "/qr/SY-DAM-K7X4" },
  {
    label: "POST /validate",
    method: "POST" as const,
    path: "/validate",
    body: { code: "SY-DAM-K7X4", latitude: 33.5138, longitude: 36.2765 },
  },
];

function SandboxConsole() {
  const { t } = useI18n();
  const [key, setKey] = useState("");
  const [index, setIndex] = useState(0);
  const [output, setOutput] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const req = SANDBOX_REQUESTS[index]!;
    setBusy(true);
    setOutput("");
    try {
      const res = await fetch(`/api/public/v1${req.path}`, {
        method: req.method,
        headers: {
          "x-api-key": key.trim(),
          ...(req.body ? { "Content-Type": "application/json" } : {}),
        },
        ...(req.body ? { body: JSON.stringify(req.body) } : {}),
      });
      const text = await res.text();
      const mode = res.headers.get("X-Syriasan-Mode") ?? "—";
      const remaining = res.headers.get("X-RateLimit-Remaining") ?? "—";
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* non JSON (SVG) stays raw */
      }
      setOutput(
        `HTTP ${res.status}  ·  X-Syriasan-Mode: ${mode}  ·  X-RateLimit-Remaining: ${remaining}\n\n${pretty}`,
      );
    } catch (error) {
      setOutput(
        t({ ar: "تعذّر تنفيذ الطلب:", en: "Couldn't run the request:" }) + ` ${(error as Error).message}`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="console" className="scroll-mt-20 rounded-2xl border border-primary/40 bg-surface p-4">
      <h2 className="text-sm font-bold">{t({ ar: "وحدة التجربة الحية", en: "Live console" })}</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {t({
          ar: "ألصق مفتاحاً تجريبياً ونفّذ طلباً حقيقياً من المتصفح. المفتاح يبقى في جهازك ولا نحفظه.",
          en: "Paste a test key and run a real request from the browser. The key stays on your device — we never store it.",
        })}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <input
          dir="ltr"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="san_test_…"
          className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
          >
            {SANDBOX_REQUESTS.map((r, i) => (
              <option key={r.label} value={i}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || key.trim().length < 8}
            onClick={() => void run()}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? t({ ar: "جارٍ التنفيذ…", en: "Running…" }) : t({ ar: "تنفيذ", en: "Run" })}
          </button>
        </div>
      </div>
      {output ? (
        <pre
          dir="ltr"
          className="mt-3 max-h-80 overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed"
        >
          {output}
        </pre>
      ) : null}
    </section>
  );
}

function DeveloperPortal() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            developers.syriasan.com
          </p>
          <h1 className="mt-1 text-xl font-bold">{t({ ar: "بوابة مطوّري سيرياسان", en: "Syriasan Developer Portal" })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t({
              ar: "كل ما يلزم لدمج العناوين الذكية السورية في متجرك أو تطبيق التوصيل أو نظام الأسطول: مصادقة، حلّ عنوان، تحقق، بحث، إنشاء، QR، توجيه، Webhooks — بأمثلة جاهزة للنسخ ووضع اختبار.",
              en: "Everything you need to integrate Syrian smart addresses into your store, delivery app or fleet system: authentication, address resolution, validation, search, creation, QR codes, navigation, webhooks — with copy-ready examples and a sandbox mode.",
            })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/developers"
              className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              {t({ ar: "احصل على مفتاح API", en: "Get an API key" })}
            </Link>
            <Link
              to="/api-reference"
              className="rounded-lg border border-primary/50 px-3 py-2 text-xs font-bold text-primary"
            >
              {t({ ar: "مرجع النقاط المختصر", en: "Quick endpoint reference" })}
            </Link>
            <Link
              to="/checkout-component"
              className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground"
            >
              {t({ ar: "مكوّن الدفع الجاهز", en: "Ready-made checkout component" })}
            </Link>
          </div>
        </header>

        <nav className="flex flex-wrap gap-1.5 rounded-2xl border border-border bg-surface p-3 text-[11px]">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-lg border border-border px-2.5 py-1 font-bold text-muted-foreground"
            >
              {t(s.title)}
            </a>
          ))}
          <a href="#console" className="rounded-lg border border-primary/50 px-2.5 py-1 font-bold text-primary">
            {t({ ar: "تجربة حية", en: "Live demo" })}
          </a>
        </nav>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">{t({ ar: "البداية السريعة", en: "Quick start" })}</h2>
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-[13px] text-muted-foreground">
            <li>{t({ ar: "أنشئ حساب مطوّر «تجريبي» من صفحة واجهة المطورين واحفظ المفتاح.", en: "Create a “test” developer account from the Developers page and save the key." })}</li>
            <li>{t({ ar: "جرّب الطلبات من وحدة التجربة أدناه أو من طرفيتك.", en: "Try requests from the console below or from your terminal." })}</li>
            <li>{t({ ar: "حين تصبح جاهزاً أنشئ حساباً «إنتاج» واستبدل المفتاح فقط — النقاط ذاتها.", en: "When you're ready, create a “live” account and just swap the key — the endpoints stay the same." })}</li>
          </ol>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground" dir="ltr">
            Base URL: {BASE} (alias: https://syriasan.com/api/public/v1)
          </p>
        </section>

        <SandboxConsole />

        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-20 rounded-2xl border border-border bg-surface p-4"
          >
            <h2 className="text-sm font-bold">{t(section.title)}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{t(section.intro)}</p>
            {section.bullets ? (
              <ul className="mt-2 list-disc space-y-1 ps-5 text-[12px] text-muted-foreground">
                {section.bullets.map((b) => (
                  <li key={b.ar}>{t(b)}</li>
                ))}
              </ul>
            ) : null}
            {section.samples ? <CodeTabs samples={section.samples} /> : null}
            {section.note ? (
              <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-[12px]">
                {t(section.note)}
              </p>
            ) : null}
          </section>
        ))}

        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          {t({ ar: "أسئلة أو رفع حدود المعدل؟ تواصل معنا من صفحة واجهة المطورين.", en: "Questions, or need higher rate limits? Reach out to us from the Developers page." })}
        </p>
      </main>
    </div>
  );
}
