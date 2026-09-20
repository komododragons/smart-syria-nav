import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { CodeTabs, type CodeSamples } from "@/components/CodeTabs";

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
  title: string;
  intro: string;
  bullets?: string[];
  samples?: CodeSamples;
  note?: string;
};

const SECTIONS: Section[] = [
  {
    id: "auth",
    title: "المصادقة",
    intro:
      "كل طلب يحتاج مفتاح API صالحاً. أرسله في ترويسة Authorization: Bearer أو x-api-key. تُخزَّن المفاتيح مُجزّأة (SHA-256) فقط ولا يمكن استرجاعها بعد إنشائها — احفظ المفتاح لحظة إنشائه.",
    bullets: [
      "أنشئ حساب مطوّر ومفتاحاً من صفحة «واجهة المطورين».",
      "لا تضع المفتاح في كود المتصفح؛ استدعِ الواجهة من خادمك.",
      "يمكن إلغاء أي مفتاح فوراً، وكل إنشاء أو إلغاء يُسجَّل في سجل التدقيق.",
    ],
    samples: {
      curl: `curl "${BASE}/resolve/SY-DAM-K7X4" \\
  -H "Authorization: Bearer san_live_…"

# بديل مكافئ
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
    title: "وضع الاختبار (Sandbox)",
    intro:
      "أنشئ حساب مطوّر من نوع «تجريبي» واستخدم مفاتيحه للتطوير. في وضع الاختبار تعمل عمليات القراءة على بيانات حقيقية عامة، بينما تُحاكى عمليات الكتابة: يُتحقَّق من الحقول ويعود ردّ 201 بالرمز SY-XXX-TEST دون حفظ أي شيء.",
    bullets: [
      "كل ردّ يحمل الترويسة X-Syriasan-Mode بقيمة test أو live.",
      "ردود المحاكاة تتضمن \"mode\": \"test\" و\"status\": \"simulated\".",
      "الرمز التجريبي للتجارب: SY-DAM-K7X4.",
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
    title: "حلّ العنوان — Resolve",
    intro:
      "GET /resolve/{code} يعيد المدخل الموصى به حسب الغرض (توصيل طرد، طعام، زيارة، إسعاف، شاحنة…) مع الإحداثيات والتعليمات والقيود. هذه هي النقطة التي تستخدمها تطبيقات التوصيل.",
    samples: samples("GET", "/resolve/SY-DAM-K7X4?purpose=parcel_delivery&wheelchair=true"),
    note: "المدخل المعاد هو نقطة الوصول الفعلية وليس مركز المبنى.",
  },
  {
    id: "validate",
    title: "التحقق — Validate",
    intro:
      "POST /validate يتحقق من صيغة الرمز ووجوده، ومن وقوع الإحداثيات داخل سوريا، ويعيد درجة اكتمال للعنوان — مناسب لحقول الدفع والتسجيل.",
    samples: samples("POST", "/validate", {
      code: "SY-DAM-K7X4",
      latitude: 33.5138,
      longitude: 36.2765,
    }),
  },
  {
    id: "search",
    title: "البحث — Search",
    intro:
      "GET /search يبحث في العناوين العامة فقط بالاسم أو الشارع، مع تصفية بالمحافظة والمدينة وحدّ أقصى 50 نتيجة.",
    samples: samples("GET", "/search?q=mazzeh&governorate=دمشق&limit=10"),
  },
  {
    id: "create",
    title: "إنشاء عنوان — Create Address",
    intro:
      "POST /addresses ينشئ عنواناً عاماً جديداً ويولّد رمزه الذكي تلقائياً. يتطلب صلاحية addresses:write، وينشئ عناوين عامة فقط — لا يمكن إنشاء عناوين سكنية خاصة عبر الواجهة.",
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
    title: "رموز QR",
    intro:
      "GET /qr/{code} يعيد بيانات الرمز بصيغة JSON، أو صورة SVG جاهزة للطباعة عند تمرير format=svg مع مقاس بين 128 و2048 بكسل.",
    samples: samples("GET", "/qr/SY-DAM-K7X4?format=svg&size=640"),
    note: "يفتح المسح صفحة العنوان العامة /a/CODE، ولا يكشف أبداً بيانات خاصة.",
  },
  {
    id: "navigation",
    title: "التوجيه — Navigation",
    intro:
      "GET /route يحسب المسار من نقطة انطلاق حتى المدخل المناسب للعنوان، بالسيارة أو مشياً أو بالدراجة، ويعيد المسافة والزمن وهندسة المسار.",
    samples: samples("GET", "/route?from=33.5020,36.2900&to=SY-DAM-K7X4&mode=driving"),
    note: "الوجهة دائماً المدخل المختار، لا مركز المبنى. عند تعذّر خدمة المسارات يعود مسار تقريبي مع degraded: true.",
  },
  {
    id: "webhooks",
    title: "Webhooks",
    intro:
      "سجّل رابط HTTPS ليصلك إشعار فوري عند وقوع الأحداث: address.created، address.resolved، address.navigation_started، address.delivery_viewed، address.qr_scanned. يُعاد السر مرة واحدة فقط عند الإنشاء.",
    bullets: [
      "POST /webhooks — إنشاء اشتراك (url + events).",
      "GET /webhooks — عرض الاشتراكات وعدّادات التسليم والإخفاق.",
      "POST /webhooks/test — إرسال تسليم تجريبي.",
      "POST /webhooks/delete — حذف اشتراك.",
      "كل تسليم يحمل X-Syriasan-Event وX-Syriasan-Timestamp وX-Syriasan-Signature.",
    ],
    samples: {
      curl: `curl -X POST ${BASE}/webhooks \\
  -H "Authorization: Bearer $SYRIASAN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com/hooks/syriasan","events":["address.resolved","address.delivery_viewed"]}'`,
      javascript: `// تحقّق من التوقيع قبل الوثوق بأي حمولة
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
    note: "التوقيع يُحسب على النص «الطابع الزمني.الجسم الخام» بخوارزمية HMAC-SHA256. ارفض أي طابع زمني أقدم من خمس دقائق.",
  },
  {
    id: "errors",
    title: "الأخطاء",
    intro:
      "كل خطأ يعود بصيغة JSON موحّدة: {\"error\":\"رمز_الخطأ\",\"message\":\"شرح\"} مع رمز HTTP مناسب.",
    bullets: [
      "400 invalid_request — حقول ناقصة أو غير صالحة.",
      "401 missing_api_key / invalid_api_key / revoked_api_key / expired_api_key.",
      "403 insufficient_scope — المفتاح لا يملك الصلاحية المطلوبة.",
      "403 private — العنوان سكني خاص ولن يُكشف.",
      "403 inactive_client — حساب المطوّر موقوف.",
      "404 not_found / unknown_endpoint.",
      "422 out_of_bounds / no_coordinates — إحداثيات خارج سوريا أو مدخل بلا إحداثيات.",
      "429 rate_limited — تجاوز حدّ المعدل.",
    ],
  },
  {
    id: "limits",
    title: "حدود المعدل",
    intro:
      "لكل حساب مطوّر حدّ طلبات بالدقيقة (٦٠ افتراضياً، قابل للرفع). كل ردّ يحمل X-RateLimit-Limit وX-RateLimit-Remaining، وعند التجاوز يعود 429 مع Retry-After: 60.",
    bullets: [
      "راقب الترويسات وطبّق إعادة محاولة تصاعدية عند 429.",
      "خزّن نتائج الحلّ مؤقتاً لبضع دقائق لتقليل الاستهلاك.",
      "كل طلب يُسجَّل في تقرير الاستهلاك مع النقطة والحالة وزمن الاستجابة.",
    ],
  },
  {
    id: "privacy",
    title: "الخصوصية",
    intro:
      "الخصوصية غير قابلة للتفاوض. العناوين السكنية خاصة افتراضياً ولا تظهر في الواجهة إطلاقاً: يعود 403 private دون أي تسلسل أو إحداثيات أو بيانات مالك.",
    bullets: [
      "لا تُعاد أسماء أو هواتف السكان؛ الهواتف العامة للأنشطة التجارية المنشورة فقط.",
      "الطابق والشقة يظهران فقط عبر رابط مشاركة مؤقت ينشئه صاحب العنوان.",
      "الروابط المؤقتة لا تجعل البيانات قابلة للبحث، وتنتهي أو تُلغى فوراً.",
      "لا تخزّن بيانات عنوان أكثر مما تحتاجه لإتمام الطلب.",
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
      setOutput(`تعذّر تنفيذ الطلب: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="console" className="scroll-mt-20 rounded-2xl border border-primary/40 bg-surface p-4">
      <h2 className="text-sm font-bold">وحدة التجربة الحية</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        ألصق مفتاحاً تجريبياً ونفّذ طلباً حقيقياً من المتصفح. المفتاح يبقى في جهازك ولا نحفظه.
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
            {busy ? "جارٍ التنفيذ…" : "تنفيذ"}
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
  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <AppHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <header>
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            developers.syriasan.com
          </p>
          <h1 className="mt-1 text-xl font-bold">بوابة مطوّري سيرياسان</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كل ما يلزم لدمج العناوين الذكية السورية في متجرك أو تطبيق التوصيل أو نظام الأسطول:
            مصادقة، حلّ عنوان، تحقق، بحث، إنشاء، QR، توجيه، Webhooks — بأمثلة جاهزة للنسخ ووضع اختبار.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/developers"
              className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
            >
              احصل على مفتاح API
            </Link>
            <Link
              to="/api-reference"
              className="rounded-lg border border-primary/50 px-3 py-2 text-xs font-bold text-primary"
            >
              مرجع النقاط المختصر
            </Link>
            <Link
              to="/checkout-component"
              className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground"
            >
              مكوّن الدفع الجاهز
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
              {s.title}
            </a>
          ))}
          <a href="#console" className="rounded-lg border border-primary/50 px-2.5 py-1 font-bold text-primary">
            تجربة حية
          </a>
        </nav>

        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">البداية السريعة</h2>
          <ol className="mt-2 list-decimal space-y-1 pe-5 text-[13px] text-muted-foreground">
            <li>أنشئ حساب مطوّر «تجريبي» من صفحة واجهة المطورين واحفظ المفتاح.</li>
            <li>جرّب الطلبات من وحدة التجربة أدناه أو من طرفيتك.</li>
            <li>حين تصبح جاهزاً أنشئ حساباً «إنتاج» واستبدل المفتاح فقط — النقاط ذاتها.</li>
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
            <h2 className="text-sm font-bold">{section.title}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{section.intro}</p>
            {section.bullets ? (
              <ul className="mt-2 list-disc space-y-1 pe-5 text-[12px] text-muted-foreground">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
            {section.samples ? <CodeTabs samples={section.samples} /> : null}
            {section.note ? (
              <p className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-[12px]">
                {section.note}
              </p>
            ) : null}
          </section>
        ))}

        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          أسئلة أو رفع حدود المعدل؟ تواصل معنا من صفحة واجهة المطورين.
        </p>
      </main>
    </div>
  );
}
