import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";

export const Route = createFileRoute("/developers")({
  head: () => infoHead("مطورو سيريا سان — Syriasan Developers", "واجهة برمجة لحل عناوين سيريا سان وتوجيه التوصيل إلى المدخل الصحيح."),
  component: () => (
    <InfoPage
      title={{ ar: "المطورون", en: "Developers" }}
      intro={{ ar: "اربط تطبيقك بعناوين سيريا سان: حل الرموز، المداخل حسب السياق، والأحداث الموقعة.", en: "Connect your app to Syriasan addresses: code resolution, context-aware entrances and signed events." }}
      actions={[{ to: "/docs", label: { ar: "التوثيق", en: "Documentation" }, primary: true }, { to: "/api-reference", label: { ar: "مرجع الواجهة", en: "API reference" } }, { to: "/developer-dashboard", label: { ar: "لوحة المطور — المفاتيح (تسجيل الدخول)", en: "Developer dashboard — keys (sign in)" } }]}
      sections={[
        { heading: { ar: "عام ومجاني للقراءة", en: "Public docs" }, body: { ar: "التوثيق والمرجع متاحان للجميع دون حساب.", en: "Documentation and reference are open to everyone without an account." } },
        { heading: { ar: "المفاتيح في لوحة المطور", en: "Keys live in the dashboard" }, body: { ar: "إنشاء المشاريع ومفاتيح API والـwebhooks والاستخدام يتطلب تسجيل الدخول.", en: "Creating projects, API keys, webhooks and viewing usage requires signing in." } },
        { heading: { ar: "العناوين العامة فقط", en: "Public addresses only" }, body: { ar: "لا تعيد الواجهة أبداً أسماء السكان أو الهواتف أو تفاصيل الوحدات الخاصة.", en: "The API never returns resident names, phones or private unit details." } },
      ]}
    />
  ),
});
