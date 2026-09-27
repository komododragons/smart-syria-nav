import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";

export const Route = createFileRoute("/for-business")({
  head: () => infoHead("سيريا سان للأعمال — Syriasan for Business", "أضف عنوان عملك مجاناً وطوّر إدارة العنوان باشتراك احترافي."),
  component: () => (
    <InfoPage
      title={{ ar: "سيريا سان للأعمال", en: "Syriasan for Business" }}
      intro={{ ar: "أضف عنوان عملك الأساسي مجاناً. العنوان مجاني؛ الإدارة الاحترافية مدفوعة.", en: "Add your basic business address for free. The address is free; professional address management is paid." }}
      actions={[{ to: "/create", label: { ar: "+ أضف عملك", en: "+ Add your business" }, primary: true }, { to: "/dashboard", label: { ar: "لوحة الأعمال", en: "Business dashboard" } }, { to: "/plans", label: { ar: "الخطط", en: "Plans" } }]}
      sections={[
        { heading: { ar: "مجاناً للجميع", en: "Free for everyone" }, body: { ar: "الاسم والموقع والفئة الأساسية ورمز سيريا سان ودبوس المدخل والتوصيل والمطالبة بالملكية والتوثيق الأساسي.", en: "Name, map position, basic category, Syriasan code, entrance and delivery pin, ownership claim and basic verification." } },
        { heading: { ar: "عمل موثّق", en: "Verified Business" }, body: { ar: "طالب بعنوانك وقدّم إثبات الملكية ليحصل عملك على شارة «عمل موثّق» بعد مراجعة المشرفين.", en: "Claim your address and submit proof to earn the Verified Business badge after moderator review." } },
        { heading: { ar: "الإدارة الاحترافية", en: "Professional tools" }, body: { ar: "الفروع، المداخل والطوابق المتعددة، التحليلات، تكاملات التوصيل وواجهة البرمجة.", en: "Branches, multiple entrances and floors, analytics, delivery integrations and API access." } },
      ]}
    />
  ),
});
