import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";

export const Route = createFileRoute("/terms")({
  head: () => infoHead("شروط الاستخدام — سيريا سان", "شروط استخدام الشبكة السورية للعنوان الذكي."),
  component: () => (
    <InfoPage
      title={{ ar: "شروط الاستخدام", en: "Terms of use" }}
      intro={{ ar: "باستخدام سيريا سان توافق على تقديم معلومات عنوان صحيحة وعدم إساءة الاستخدام.", en: "By using Syriasan you agree to provide accurate address information and not misuse the service." }}
      sections={[
        { heading: { ar: "التصنيف الصحيح", en: "Correct classification" }, body: { ar: "يجب تصنيف عناوين الأعمال كأعمال حتى لو أدارها فرد.", en: "Business addresses must be classified as businesses even when managed by an individual." } },
        { heading: { ar: "المحتوى", en: "Content" }, body: { ar: "قد تُراجع التصحيحات والمطالبات من قبل المشرفين قبل اعتمادها.", en: "Corrections and claims may be reviewed by moderators before approval." } },
      ]}
    />
  ),
});
