import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";

export const Route = createFileRoute("/for-couriers")({
  head: () => infoHead("سيريا سان لشركات التوصيل — Syriasan for Couriers", "توصيل إلى المدخل الصحيح عبر رموز سيريا سان ومسارات متعددة الوقفات."),
  component: () => (
    <InfoPage
      title={{ ar: "سيريا سان لشركات التوصيل", en: "Syriasan for Couriers" }}
      intro={{ ar: "امسح الرمز، اتبع المسار، وسلّم عند المدخل الصحيح.", en: "Scan the code, follow the route, deliver at the right entrance." }}
      actions={[{ to: "/scan", label: { ar: "امسح رمز QR", en: "Scan a QR code" }, primary: true }, { to: "/courier", label: { ar: "لوحة التوصيل (تسجيل الدخول)", en: "Courier dashboard (sign in)" } }]}
      sections={[
        { heading: { ar: "مداخل التوصيل", en: "Delivery entrances" }, body: { ar: "كل عنوان يمكن أن يحدد مدخل تحميل أو باباً خلفياً مخصصاً للتوصيل.", en: "Each address can mark a loading bay or rear door for deliveries." } },
        { heading: { ar: "مسارات متعددة الوقفات", en: "Multi-stop routes" }, body: { ar: "ترتيب الوقفات وحساب الأوقات متاح لحسابات التوصيل المسجلة.", en: "Stop ordering and timing are available to signed-in courier accounts." } },
        { heading: { ar: "الخصوصية أولاً", en: "Privacy first" }, body: { ar: "لا يرى السائق تفاصيل الشقة أو الهاتف إلا إذا شاركها صاحب العنوان.", en: "Drivers only see unit or phone details when the address owner shares them." } },
      ]}
    />
  ),
});
