import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { SyriasanAddressField, type CheckoutAddressPayload } from "@/components/SyriasanAddressField";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/checkout-component")({
  head: () => ({
    meta: [
      { title: "مكوّن العنوان للمتاجر الإلكترونية | سيرياسان" },
      {
        name: "description",
        content:
          "أضف حقل العنوان الذكي إلى صفحة الدفع: يدخل العميل رمز سيرياسان فيُحل العنوان ويؤكده. جاهز لـ WooCommerce وShopify والمتاجر المخصصة وتطبيقات التوصيل.",
      },
      { property: "og:title", content: "مكوّن العنوان للمتاجر — سيرياسان" },
      {
        property: "og:description",
        content: "بدل كتابة العنوان السوري الطويل، يكتب العميل رمزاً واحداً ويؤكد.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutComponentPage,
});

const card = "rounded-2xl border border-border bg-surface p-4 shadow-sm";

const EMBED_SNIPPET = `<!-- 1. ضع الإطار في صفحة الدفع -->
<iframe
  id="syriasan-address"
  src="https://syriasan.com/embed/address"
  style="width:100%;height:520px;border:0"
  title="Syriasan address"
></iframe>

<script>
  window.addEventListener('message', function (event) {
    if (event.origin !== 'https://syriasan.com') return;
    if (event.data && event.data.type === 'syriasan:address') {
      var a = event.data.payload;
      document.querySelector('[name="billing_address_1"]').value = a.summary;
      document.querySelector('[name="syriasan_code"]').value = a.reference;
      document.querySelector('[name="syriasan_lat"]').value = a.coordinates ? a.coordinates.latitude : '';
      document.querySelector('[name="syriasan_lng"]').value = a.coordinates ? a.coordinates.longitude : '';
    }
  });
</script>`;

const REACT_SNIPPET = `import { SyriasanAddressField } from "@/components/SyriasanAddressField";

<SyriasanAddressField
  apiBase="https://syriasan.com"
  onConfirm={(address) => {
    setOrderAddress({
      code: address.reference,
      line: address.summary,
      lat: address.coordinates?.latitude,
      lng: address.coordinates?.longitude,
      navigation: address.navigation_url,
    });
  }}
/>`;

const API_SNIPPET = `GET https://syriasan.com/api/public/checkout?reference=SY-DAM-K7X4

{
  "status": "ok",
  "source": "code",
  "reference": "SY-DAM-K7X4",
  "summary": "دمشق — المزة — شارع الجلاء — بناء 12 — المدخل الرئيسي",
  "fields": {
    "governorate": "دمشق", "city": "دمشق", "district": null,
    "neighborhood": "المزة", "street": "شارع الجلاء",
    "building": "12", "entrance": "المدخل الرئيسي",
    "floor": null, "unit": null, "landmark": "مقابل الحديقة"
  },
  "coordinates": { "latitude": 33.51, "longitude": 36.278 },
  "delivery": { "instructions": "…", "parking": "…", "open_now": true },
  "verification_level": "business_verified",
  "navigation_url": "https://syriasan.com/d/SY-DAM-K7X4",
  "privacy_note": "عنوان عام — لا تُعرض أي بيانات سكنية خاصة."
}`;

const WOO_SNIPPET = `// functions.php — WooCommerce
add_action('woocommerce_before_checkout_billing_form', function () {
  echo '<iframe src="https://syriasan.com/embed/address" style="width:100%;height:520px;border:0"></iframe>';
  echo '<input type="hidden" name="syriasan_code" id="syriasan_code" />';
});

add_action('woocommerce_checkout_create_order', function ($order) {
  if (!empty($_POST['syriasan_code'])) {
    $order->update_meta_data('syriasan_code', sanitize_text_field($_POST['syriasan_code']));
  }
});`;

const SHOPIFY_SNIPPET = `{% comment %} Shopify — checkout / cart page block {% endcomment %}
<iframe src="https://syriasan.com/embed/address" style="width:100%;height:520px;border:0"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://syriasan.com') return;
    if (e.data.type !== 'syriasan:address') return;
    fetch('/cart/update.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: {
        syriasan_code: e.data.payload.reference,
        syriasan_address: e.data.payload.summary
      } })
    });
  });
</script>`;

function Snippet({ title, code }: { title: string; code: string }) {
  const { t } = useI18n();
  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{title}</h3>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[11px] font-bold"
          onClick={() => {
            void navigator.clipboard.writeText(code);
            toast.success(t({ ar: "تم النسخ", en: "Copied" }));
          }}
        >
          <Copy className="size-3" /> {t({ ar: "نسخ", en: "Copy" })}
        </button>
      </div>
      <pre
        dir="ltr"
        className="mt-2 max-h-80 overflow-auto rounded-xl bg-muted/50 p-3 text-left text-[11px] leading-relaxed"
      >
        <code>{code}</code>
      </pre>
    </section>
  );
}

function CheckoutComponentPage() {
  const { t } = useI18n();
  const [confirmed, setConfirmed] = useState<CheckoutAddressPayload | null>(null);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AppHeader />
      <main className="mx-auto grid max-w-5xl gap-4 p-4">
        <header>
          <h1 className="text-xl font-black">{t({ ar: "مكوّن العنوان للمتاجر الإلكترونية", en: "Address component for online stores" })}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t({
              ar: "بدل أن يكتب العميل عنواناً سورياً طويلاً في كل طلب، يكتب رمز سيرياسان مرة واحدة — يُحل العنوان ويؤكده العميل، ويصل المتجر إلى إحداثيات المدخل مباشرة. لا تُكشف بيانات الشقة الخاصة إلا إذا شاركها صاحب العنوان عبر رابط مؤقت.",
              en: "Instead of typing a long Syrian address on every order, the customer enters a Syriasan code once — the address resolves and the customer confirms it, giving the store the entrance coordinates directly. Private apartment details are never exposed unless the address owner shares them through a temporary link.",
            })}
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-3">
            <SyriasanAddressField onConfirm={setConfirmed} onClear={() => setConfirmed(null)} />
            {confirmed ? (
              <section className={card}>
                <h3 className="text-sm font-bold">{t({ ar: "ما يستلمه المتجر عند التأكيد", en: "What the store receives on confirmation" })}</h3>
                <pre
                  dir="ltr"
                  className="mt-2 max-h-72 overflow-auto rounded-xl bg-muted/50 p-3 text-left text-[11px]"
                >
                  <code>{JSON.stringify(confirmed, null, 2)}</code>
                </pre>
              </section>
            ) : null}
          </div>

          <div className="grid gap-3">
            <Snippet title={t({ ar: "تضمين في أي متجر (HTML + JS)", en: "Embed in any store (HTML + JS)" })} code={EMBED_SNIPPET} />
            <Snippet title={t({ ar: "React / Next.js", en: "React / Next.js" })} code={REACT_SNIPPET} />
          </div>
        </div>

        <Snippet title={t({ ar: "واجهة REST العامة", en: "Public REST API" })} code={API_SNIPPET} />
        <div className="grid gap-4 lg:grid-cols-2">
          <Snippet title={t({ ar: "WooCommerce", en: "WooCommerce" })} code={WOO_SNIPPET} />
          <Snippet title={t({ ar: "Shopify", en: "Shopify" })} code={SHOPIFY_SNIPPET} />
        </div>

        <section className={card}>
          <h3 className="text-sm font-bold">{t({ ar: "قواعد الخصوصية في الدفع", en: "Privacy rules at checkout" })}</h3>
          <ul className="mt-2 grid gap-1 text-xs text-muted-foreground">
            <li>
              {t({
                ar: "• الرموز العامة تعيد بيانات عامة فقط (محافظة، حي، شارع، بناء، مدخل).",
                en: "• Public codes return only public data (governorate, neighborhood, street, building, entrance).",
              })}
            </li>
            <li>
              {t({
                ar: "• العناوين السكنية الخاصة لا تُحل عبر الرمز — تُستخدم روابط مؤقتة SY-TMP-….",
                en: "• Private residential addresses never resolve through the code — temporary SY-TMP-… links are used instead.",
              })}
            </li>
            <li>
              {t({
                ar: "• الرابط المؤقت يكشف فقط الحقول التي وافق صاحب العنوان على مشاركتها، وينتهي تلقائياً.",
                en: "• A temporary link exposes only the fields the address owner agreed to share, and it expires automatically.",
              })}
            </li>
            <li>
              {t({
                ar: "• لا يُسلَّم أي عنوان للمتجر قبل أن يضغط العميل «تأكيد هذا العنوان».",
                en: "• No address is handed to the store until the customer clicks \"Confirm this address.\"",
              })}
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
