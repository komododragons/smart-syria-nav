import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";

export const Route = createFileRoute("/contact")({
  head: () => infoHead("تواصل معنا — سيريا سان", "تواصل مع فريق سيريا سان."),
  component: () => (
    <InfoPage
      title={{ ar: "تواصل معنا", en: "Contact" }}
      intro={{ ar: "لأسئلة الأعمال أو المطورين أو الإبلاغ عن مشكلة.", en: "For business, developer questions or to report a problem." }}
      sections={[
        { heading: { ar: "تصحيح عنوان", en: "Correct an address" }, body: { ar: "افتح صفحة العنوان واستخدم «اقترح تصحيحاً».", en: "Open the address page and use “Suggest a correction”." } },
        { heading: { ar: "البريد", en: "Email" }, body: { ar: "hello@damasol.net", en: "hello@damasol.net" } },
      ]}
    />
  ),
});
