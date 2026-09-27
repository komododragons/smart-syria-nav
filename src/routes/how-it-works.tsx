import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";

export const Route = createFileRoute("/how-it-works")({
  head: () => infoHead("كيف يعمل سيريا سان — Syriasan", "أنشئ عنواناً، شارك الرمز، ويصل الزائر إلى المدخل الصحيح."),
  component: () => (
    <InfoPage
      title={{ ar: "كيف يعمل سيريا سان", en: "How Syriasan works" }}
      intro={{ ar: "عنوان واحد يوصل الزائر إلى المدخل الصحيح، لا إلى مركز المبنى فقط.", en: "One address that takes visitors to the right entrance, not just the middle of a building." }}
      actions={[{ to: "/create", label: { ar: "+ أنشئ عنواناً", en: "+ Create address" }, primary: true }, { to: "/search", label: { ar: "ابحث", en: "Search" } }]}
      sections={[
        { heading: { ar: "١. أنشئ عنوانك", en: "1. Create your address" }, body: { ar: "حدّد الموقع والمبنى والمدخل. يمكنك البدء دون حساب، وتسجّل الدخول عند الحفظ.", en: "Pick the location, building and entrance. Start without an account; sign in to save." } },
        { heading: { ar: "٢. احصل على رمز سيريا سان", en: "2. Get your Syriasan code" }, body: { ar: "رمز قصير مثل SY-XXX-XXXX مع بطاقة QR.", en: "A short code like SY-XXX-XXXX with a QR card." } },
        { heading: { ar: "٣. شارك بخصوصية", en: "3. Share privately" }, body: { ar: "العناوين السكنية خاصة افتراضياً وتُشارك برمز أو رابط مؤقت قابل للإلغاء.", en: "Homes are private by default and shared by code or an expiring, revocable link." } },
        { heading: { ar: "٤. الوصول إلى المدخل الصحيح", en: "4. Arrive at the right door" }, body: { ar: "تعليمات مختلفة للزائر والتوصيل والشاحنات والطوارئ.", en: "Different directions for visitors, deliveries, trucks and emergencies." } },
      ]}
    />
  ),
});
