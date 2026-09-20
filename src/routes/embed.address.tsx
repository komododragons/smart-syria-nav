import { createFileRoute } from "@tanstack/react-router";

import { SyriasanAddressField, type CheckoutAddressPayload } from "@/components/SyriasanAddressField";

/**
 * Iframe-embeddable checkout widget. Any store (WooCommerce, Shopify, custom)
 * can embed this page and listen for the `syriasan:address` postMessage event.
 */
export const Route = createFileRoute("/embed/address")({
  head: () => ({
    meta: [
      { title: "حقل العنوان الذكي | سيرياسان" },
      {
        name: "description",
        content: "أداة قابلة للتضمين تتيح لعملاء المتاجر إدخال رمز سيرياسان بدل كتابة العنوان كاملاً.",
      },
      { property: "og:title", content: "حقل العنوان الذكي للمتاجر — سيرياسان" },
      { property: "og:description", content: "أدخل رمز سيرياسان وأكّد العنوان داخل صفحة الدفع." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmbedAddressPage,
});

function EmbedAddressPage() {
  function post(type: string, payload: unknown) {
    if (typeof window === "undefined" || window.parent === window) return;
    window.parent.postMessage({ type, payload }, "*");
  }

  return (
    <div className="bg-transparent p-2">
      <SyriasanAddressField
        compact
        onConfirm={(address: CheckoutAddressPayload) => post("syriasan:address", address)}
        onClear={() => post("syriasan:address-cleared", null)}
      />
    </div>
  );
}
