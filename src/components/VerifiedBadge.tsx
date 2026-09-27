import { BadgeCheck, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Independently checked (field, courier, business, organisation or official) — not owner/community only. */
const ADDRESS_VERIFIED = new Set([
  "courier_verified",
  "business_verified",
  "organization_verified",
  "official_verified",
]);
/** Business ownership proven through an approved claim or official record. */
const BUSINESS_VERIFIED = new Set(["business_verified", "organization_verified", "official_verified"]);

export const isVerifiedAddress = (level?: string | null) => !!level && ADDRESS_VERIFIED.has(level);
export const isVerifiedBusiness = (level?: string | null) => !!level && BUSINESS_VERIFIED.has(level);

export function VerifiedBadge({ kind, level }: { kind: "address" | "business"; level?: string | null }) {
  const { t } = useI18n();
  const ok = kind === "address" ? isVerifiedAddress(level) : isVerifiedBusiness(level);
  if (!ok) return null;
  const Icon = kind === "address" ? ShieldCheck : BadgeCheck;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-allow-surface px-2 py-1 text-[11px] font-bold text-allow"
      title={t(
        kind === "address"
          ? { ar: "تم التحقق من هذا العنوان بشكل مستقل", en: "This address was independently verified" }
          : { ar: "تم التحقق من ملكية هذا العمل", en: "This business's ownership was verified" },
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {t(kind === "address" ? { ar: "عنوان موثّق", en: "Verified Address" } : { ar: "عمل موثّق", en: "Verified Business" })}
    </span>
  );
}
