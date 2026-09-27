import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";

export const Route = createFileRoute("/about")({
  head: () => infoHead("من نحن — سيريا سان", "سيريا سان: الشبكة السورية للعنوان الذكي، بنية عنوان رقمية محايدة."),
  component: () => (
    <InfoPage
      title={{ ar: "من نحن", en: "About Syriasan" }}
      intro={{ ar: "سيريا سان هي الشبكة السورية للعنوان الذكي: بنية عنوان رقمية محايدة ومتاحة للجميع.", en: "Syriasan is the Syrian Smart Address Network: neutral digital address infrastructure for everyone." }}
      sections={[
        { heading: { ar: "مهمتنا", en: "Our mission" }, body: { ar: "أن يصل كل زائر وسائق ومسعف إلى الوجهة والمدخل الصحيحين.", en: "Help every visitor, driver and responder reach the right destination and entrance." } },
        { heading: { ar: "مبادئنا", en: "Our principles" }, body: { ar: "الخصوصية للمنازل، الحياد للخريطة، والشفافية في التوثيق.", en: "Privacy for homes, neutrality for the map, transparency in verification." } },
      ]}
    />
  ),
});
