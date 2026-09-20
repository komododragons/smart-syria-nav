import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Boxes, CheckCircle2, Code2, Puzzle, ShieldCheck, Smartphone } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { SnippetTabs } from "@/components/SnippetTabs";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/widget")({
  head: () => ({
    meta: [
      { title: "أداة العنوان القابلة للتضمين | سيرياسان" },
      {
        name: "description",
        content:
          "أضف حقل العنوان الذكي إلى أي موقع بسطر واحد: يكتب العميل رمز سيرياسان، يظهر العنوان، ثم يؤكده. بروتوكول موحّد جاهز لحزم JavaScript وReact وFlutter والتطبيقات الأصلية.",
      },
      { property: "og:title", content: "أداة العنوان القابلة للتضمين — سيرياسان" },
      {
        property: "og:description",
        content: "سطر واحد لإضافة حقل عنوان سيرياسان إلى متجرك أو تطبيقك، مع بروتوكول رسائل موحّد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WidgetPage,
});

const card = "rounded-2xl border border-border bg-surface p-4 shadow-sm";

const SNIPPETS = [
  {
    id: "html",
    label: "HTML",
    code: `<!-- سطر واحد: العنصر + السكربت -->
<div
  data-syriasan-address
  data-lang="en"
  data-bind-code="#order_syriasan_code"
  data-bind-summary="[name='billing_address_1']"
  data-bind-latitude="#order_lat"
  data-bind-longitude="#order_lng"
></div>
<script src="https://syriasan.com/widget.js" async></script>

<input type="hidden" id="order_syriasan_code" name="syriasan_code" />
<input type="hidden" id="order_lat" name="syriasan_lat" />
<input type="hidden" id="order_lng" name="syriasan_lng" />`,
  },
  {
    id: "js",
    label: "JavaScript",
    code: `const widget = Syriasan.mount('#address-holder', {
  lang: 'en',                 // 'ar' | 'en'
  compact: true,
  autoHeight: true,           // the iframe resizes itself
  onReady: () => console.log('widget ready'),
  onResolve: (address) => console.log('found', address.summary),
  onConfirm: (address) => {
    order.syriasanCode = address.reference;      // SY-DAM-K7X4
    order.line = address.summary;                // Damascus — Mazzeh
    order.lat = address.coordinates?.latitude;
    order.lng = address.coordinates?.longitude;
  },
  onClear: () => { order.syriasanCode = null; },
});

// restore a saved code on a returning customer
widget.setCode('SY-DAM-K7X4', true);

// resolve without any UI
const res = await Syriasan.resolve('SY-DAM-K7X4');`,
  },
  {
    id: "react",
    label: "React",
    code: `import { SyriasanAddressField } from "@syriasan/react"; // or copy the component

export function CheckoutAddress({ onChange }) {
  return (
    <SyriasanAddressField
      apiBase="https://syriasan.com"
      lang="en"
      onConfirm={(address) => onChange({
        code: address.reference,
        line: address.summary,
        lat: address.coordinates?.latitude ?? null,
        lng: address.coordinates?.longitude ?? null,
      })}
      onClear={() => onChange(null)}
    />
  );
}`,
  },
  {
    id: "flutter",
    label: "Flutter",
    code: `// Same protocol, rendered in a WebView. A future @syriasan/flutter package
// wraps exactly this.
final controller = WebViewController()
  ..setJavaScriptMode(JavaScriptMode.unrestricted)
  ..addJavaScriptChannel('SyriasanHost', onMessageReceived: (msg) {
      final event = jsonDecode(msg.message);
      if (event['type'] == 'syriasan:address') {
        final a = event['payload'];
        setState(() => orderCode = a['reference']);   // SY-DAM-K7X4
      }
    })
  ..loadRequest(Uri.parse('https://syriasan.com/embed/address?lang=en&compact=1'));

// bridge postMessage -> SyriasanHost
await controller.runJavaScript(
  "window.addEventListener('message',e=>SyriasanHost.postMessage(JSON.stringify(e.data)))");`,
  },
  {
    id: "native",
    label: "iOS / Android",
    code: `// iOS (WKWebView)
let config = WKWebViewConfiguration()
config.userContentController.add(self, name: "syriasan")
config.userContentController.addUserScript(WKUserScript(
  source: "window.addEventListener('message',e=>window.webkit.messageHandlers.syriasan.postMessage(e.data))",
  injectionTime: .atDocumentEnd, forMainFrameOnly: true))
webView.load(URLRequest(url: URL(string: "https://syriasan.com/embed/address?lang=en")!))

// Android (WebView)
webView.addJavascriptInterface(object {
  @JavascriptInterface fun post(json: String) { handleSyriasanEvent(json) }
}, "SyriasanHost")
webView.loadUrl("https://syriasan.com/embed/address?lang=en")`,
  },
  {
    id: "rest",
    label: "REST",
    code: `# Server-side validation of whatever the widget submitted
curl "https://syriasan.com/api/public/checkout?reference=SY-DAM-K7X4"

# -> { "status":"ok", "reference":"SY-DAM-K7X4",
#      "summary":"دمشق — المزة",
#      "coordinates":{"latitude":33.51,"longitude":36.27}, ... }`,
  },
];

const EVENTS: { name: string; dir: { ar: string; en: string }; desc: { ar: string; en: string } }[] = [
  { name: "syriasan:ready", dir: { ar: "الأداة ← الموقع", en: "widget → host" }, desc: { ar: "الأداة جاهزة للاستقبال (تحمل رقم إصدار البروتوكول).", en: "The widget is ready to receive messages (carries the protocol version)." } },
  { name: "syriasan:resize", dir: { ar: "الأداة ← الموقع", en: "widget → host" }, desc: { ar: "ارتفاع المحتوى الحالي لضبط الإطار تلقائياً.", en: "The current content height, to auto-size the iframe." } },
  { name: "syriasan:resolved", dir: { ar: "الأداة ← الموقع", en: "widget → host" }, desc: { ar: "تم حلّ الرمز وعُرض العنوان — قبل تأكيد العميل.", en: "The code was resolved and the address shown — before customer confirmation." } },
  { name: "syriasan:address", dir: { ar: "الأداة ← الموقع", en: "widget → host" }, desc: { ar: "أكّد العميل العنوان — هنا فقط يُسلَّم للمتجر.", en: "The customer confirmed the address — only now is it handed to the store." } },
  { name: "syriasan:address-cleared", dir: { ar: "الأداة ← الموقع", en: "widget → host" }, desc: { ar: "ألغى العميل التأكيد أو غيّر الرمز.", en: "The customer cleared the confirmation or changed the code." } },
  { name: "syriasan:set-code", dir: { ar: "الموقع ← الأداة", en: "host → widget" }, desc: { ar: "تعبئة رمز محفوظ مسبقاً وحلّه اختيارياً.", en: "Prefill a previously saved code and optionally resolve it." } },
];

function WidgetPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <header className="flex items-start gap-3">
          <Puzzle className="mt-1 size-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">{t({ ar: "أداة العنوان القابلة للتضمين", en: "Embeddable address widget" })}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t({
                ar: "حقل عنوان جاهز يُضاف إلى أي موقع أو تطبيق: يكتب العميل رمز سيرياسان، يتحقق فوراً، يرى «دمشق — المزة»، ثم يضغط «تأكيد العنوان». لا يُسلَّم أي شيء للمتجر قبل التأكيد، ولا تُكشف بيانات السكن الخاصة أبداً.",
                en: "A ready-made address field to drop into any site or app: the customer types a Syriasan code, it's validated instantly, they see “Damascus — Mazzeh”, then tap “Confirm address”. Nothing is handed to the store before confirmation, and private residential data is never exposed.",
              })}
            </p>
          </div>
        </header>

        <LiveDemo />

        <section className={`${card} mt-4`}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Code2 className="size-4 text-primary" /> {t({ ar: "التركيب", en: "Integration" })}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t({
              ar: "نفس الأداة، خمس طرق للتضمين. ابدأ بـ HTML: عنصر واحد وسكربت واحد، وتُملأ حقول الطلب تلقائياً.",
              en: "The same widget, five ways to embed it. Start with HTML: one element and one script, and your order fields fill in automatically.",
            })}
          </p>
          <SnippetTabs snippets={SNIPPETS} />
        </section>

        <section className={`${card} mt-4`}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Boxes className="size-4 text-primary" /> {t({ ar: "بروتوكول الأداة (الإصدار 1)", en: "Widget protocol (version 1)" })}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t({
              ar: "كل الحزم المستقبلية — JavaScript وReact وFlutter والتطبيقات الأصلية — تتحدث بهذه الرسائل نفسها، لذا يبقى التكامل صالحاً عند تحديث واجهة الأداة.",
              en: "Every future package — JavaScript, React, Flutter and native apps — speaks these same messages, so integrations stay valid as the widget's UI evolves.",
            })}
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            {EVENTS.map((e) => (
              <div
                key={e.name}
                className="flex flex-col gap-1 border-b border-border/60 p-2.5 text-xs last:border-0 sm:flex-row sm:items-center"
              >
                <code dir="ltr" className="w-56 shrink-0 font-mono text-[11px] font-bold text-primary">
                  {e.name}
                </code>
                <span className="w-32 shrink-0 text-[11px] text-muted-foreground">{t(e.dir)}</span>
                <span>{t(e.desc)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            {t({ ar: "نقطة التضمين:", en: "Embed URL:" })}{" "}
            <code dir="ltr" className="font-mono">
              https://syriasan.com/embed/address?lang=ar|en&amp;compact=1&amp;code=SY-DAM-K7X4&amp;auto=1&amp;origin=https://your-store.com
            </code>
          </p>
        </section>

        <section className={`${card} mt-4`}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <Smartphone className="size-4 text-primary" /> {t({ ar: "بنية الحزم القادمة", en: "Architecture for future packages" })}
          </h2>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li>
              <b className="text-foreground">{t({ ar: "الطبقة الأولى — واجهة REST عامة:", en: "Layer one — public REST API:" })}</b>{" "}
              {t({ ar: "نقطة", en: "The" })}{" "}
              <code dir="ltr" className="font-mono">/api/public/checkout</code> {t({ ar: "وواجهة", en: "and the documented" })}{" "}
              <code dir="ltr" className="font-mono">/api/v1</code> {t({ ar: "الموثّقة. كل حزمة تستدعيها فقط.", en: "API. Every package simply calls it." })}
            </li>
            <li>
              <b className="text-foreground">{t({ ar: "الطبقة الثانية — الأداة المُستضافة:", en: "Layer two — the hosted widget:" })}</b>{" "}
              {t({ ar: "صفحة", en: "The" })}{" "}
              <code dir="ltr" className="font-mono">/embed/address</code>{" "}
              {t({
                ar: "تحمل كل المنطق والترجمة والخصوصية، فتُحدَّث لجميع المتاجر دفعة واحدة دون أن يحدّث أحد شيئاً.",
                en: "page carries all the logic, translation and privacy rules, so it updates for every store at once without anyone updating anything.",
              })}
            </li>
            <li>
              <b className="text-foreground">{t({ ar: "الطبقة الثالثة — أغلفة رقيقة:", en: "Layer three — thin wrappers:" })}</b>{" "}
              {t({ ar: "حزمة JavaScript جاهزة الآن في", en: "A JavaScript package is already available in" })}{" "}
              <code dir="ltr" className="font-mono">widget.js</code>
              {t({ ar: "، ومكوّن React، ولاحقاً", en: ", a React component, and later" })}{" "}
              <code dir="ltr" className="font-mono">syriasan_flutter</code>{" "}
              {t({
                ar: "وحزم iOS/Android — كلها مجرد غلاف حول البروتوكول أعلاه، أقل من ٢٠٠ سطر لكل منصة.",
                en: "and iOS/Android packages — all just a wrapper around the protocol above, under 200 lines per platform.",
              })}
            </li>
          </ul>
        </section>

        <section className={`${card} mt-4`}>
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-4 text-success" /> {t({ ar: "الخصوصية", en: "Privacy" })}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t({
              ar: "العناوين السكنية خاصة افتراضياً: الأداة تعرض التسلسل العام فقط. تفاصيل الطابق والشقة والهاتف لا تظهر إلا إذا شارك صاحب العنوان رابطاً مؤقتاً (SY-TMP-…)، ولا يُسلَّم أي حقل إلى المتجر قبل ضغط «تأكيد العنوان».",
              en: "Residential addresses are private by default: the widget shows only the public sequence. Floor, apartment and phone details only appear if the address owner shares a temporary link (SY-TMP-…), and no field is handed to the store before “Confirm address” is pressed.",
            })}
          </p>
        </section>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <Link to="/docs" className="rounded-lg bg-primary px-3 py-2 text-primary-foreground">
            {t({ ar: "بوابة المطورين", en: "Developer portal" })}
          </Link>
          <Link to="/checkout-component" className="rounded-lg border border-border px-3 py-2">
            {t({ ar: "مكوّن الدفع", en: "Checkout component" })}
          </Link>
          <Link to="/api-reference" className="rounded-lg border border-border px-3 py-2">
            {t({ ar: "مرجع الواجهة v1", en: "API v1 reference" })}
          </Link>
        </div>
      </main>
    </div>
  );
}

function LiveDemo() {
  const { t, lang } = useI18n();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(240);
  const [log, setLog] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<{ reference: string; summary: string } | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; payload?: any } | null;
      if (!data?.type?.startsWith("syriasan:")) return;
      if (data.type === "syriasan:resize") {
        setHeight(Number(data.payload?.height) || 240);
        return;
      }
      setLog((prev) => [`${data.type} ${data.payload?.reference ?? ""}`.trim(), ...prev].slice(0, 5));
      if (data.type === "syriasan:address") {
        setConfirmed({ reference: data.payload.reference, summary: data.payload.summary });
      }
      if (data.type === "syriasan:address-cleared") setConfirmed(null);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const src = `/embed/address?lang=${lang}&compact=1&origin=${encodeURIComponent(
    typeof window === "undefined" ? "" : window.location.origin,
  )}`;

  return (
    <section className={`${card} mt-4`}>
      <h2 className="text-sm font-bold">{t({ ar: "تجربة حية", en: "Live demo" })}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {t({ ar: "هذه هي الأداة نفسها المضمّنة في إطار، وتحتها ما يستقبله المتجر من رسائل.", en: "This is the same widget embedded in an iframe, with what the store receives shown below." })}
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <iframe
          ref={frameRef}
          title="Syriasan address widget"
          src={src}
          style={{ height }}
          className="w-full rounded-xl border border-border"
        />
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs font-bold">{t({ ar: "ما يستقبله المتجر", en: "What the store receives" })}</p>
          {confirmed ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-success/10 p-2 text-xs font-bold text-success">
              <CheckCircle2 className="size-3.5" /> {confirmed.reference} — {confirmed.summary}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t({ ar: "لا شيء بعد — العنوان يُسلَّم بعد التأكيد فقط.", en: "Nothing yet — the address is only handed over after confirmation." })}</p>
          )}
          <ul dir="ltr" className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
            {log.length === 0 ? <li>waiting for events…</li> : log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
