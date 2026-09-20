import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { SyriasanAddressField, type CheckoutAddressPayload } from "@/components/SyriasanAddressField";

/** Search values arrive as strings, numbers or booleans depending on the host. */
const flag = z.union([z.string(), z.number(), z.boolean()]).optional();

const searchSchema = z.object({
  lang: z.enum(["ar", "en"]).catch("ar").optional(),
  compact: flag,
  code: flag,
  auto: flag,
  title: flag,
  origin: flag,
});

const str = (v: string | number | boolean | undefined) => (v === undefined ? "" : String(v));

/**
 * Iframe-embeddable address widget. Any host (WooCommerce, Shopify, custom
 * store, Flutter/native WebView) embeds this page and talks to it over the
 * documented postMessage protocol:
 *
 *   widget -> host : syriasan:ready | syriasan:resize | syriasan:resolved
 *                    syriasan:address | syriasan:address-cleared
 *   host  -> widget: syriasan:set-code { code, resolve }
 */
export const Route = createFileRoute("/embed/address")({
  validateSearch: searchSchema,
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
  const search = Route.useSearch();
  const originParam = str(search.origin);
  const targetOrigin = /^https?:\/\//.test(originParam) ? originParam : "*";
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [injected, setInjected] = useState<{ code: string; resolve: boolean; nonce: number } | null>(null);

  // Host -> widget: prefill (and optionally resolve) a code.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; payload?: { code?: string; resolve?: boolean } } | null;
      if (!data || data.type !== "syriasan:set-code") return;
      if (targetOrigin !== "*" && event.origin !== targetOrigin) return;
      const code = String(data.payload?.code ?? "").slice(0, 40);
      setInjected({ code, resolve: data.payload?.resolve !== false, nonce: Date.now() });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [targetOrigin]);

  function post(type: string, payload: unknown) {
    if (typeof window === "undefined" || window.parent === window) return;
    window.parent.postMessage({ type, payload }, targetOrigin);
  }

  // Announce readiness and keep the host iframe sized to the content.
  useEffect(() => {
    post("syriasan:ready", { version: 1 });
    const el = boxRef.current;
    if (!el) return;
    const send = () => post("syriasan:resize", { height: Math.ceil(el.getBoundingClientRect().height) + 8 });
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={boxRef} className="bg-transparent p-2">
      <SyriasanAddressField
        key={injected?.nonce ?? 0}
        compact={str(search.compact) !== "0"}
        lang={search.lang ?? "ar"}
        title={str(search.title) || undefined}
        initialCode={injected?.code ?? str(search.code)}
        autoResolve={injected ? injected.resolve : str(search.auto) === "1"}
        onResolve={(address: CheckoutAddressPayload) => post("syriasan:resolved", address)}
        onConfirm={(address: CheckoutAddressPayload) => post("syriasan:address", address)}
        onClear={() => post("syriasan:address-cleared", null)}
      />
    </div>
  );
}
