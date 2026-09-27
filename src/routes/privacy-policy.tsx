import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";

export const Route = createFileRoute("/privacy-policy")({
  head: () => infoHead("سياسة الخصوصية — سيريا سان", "كيف يحمي سيريا سان العناوين السكنية والبيانات الشخصية."),
  component: () => (
    <InfoPage
      title={{ ar: "سياسة الخصوصية", en: "Privacy policy" }}
      intro={{ ar: "العناوين السكنية خاصة افتراضياً.", en: "Residential addresses are private by default." }}
      actions={[{ to: "/privacy", label: { ar: "إعدادات خصوصيتي", en: "My privacy settings" } }]}
      sections={[
        { heading: { ar: "ثلاثة مستويات", en: "Three levels" }, body: { ar: "خاص، مُشارك برمز أو رابط، أو عام قابل للبحث (للأعمال والمرافق).", en: "Private, shared by code or link, or public and searchable (businesses and facilities)." } },
        { heading: { ar: "ما لا نكشفه أبداً", en: "What we never expose" }, body: { ar: "أسماء السكان، الهواتف، البريد، تفاصيل الوحدات، تعليمات التوصيل الخاصة، وثائق التحقق، وبيانات الحساب.", en: "Resident names, phones, emails, unit details, private delivery notes, verification documents and account data." } },
      ]}
    />
  ),
});
