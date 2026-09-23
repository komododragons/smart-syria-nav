export const ADDRESS_CLASSIFICATIONS = [
  "private_residence",
  "business_shop",
  "office",
  "government_institution",
  "healthcare_facility",
  "hotel_accommodation",
  "building_residential_complex",
  "warehouse_industrial",
] as const;

export type AddressClassification = (typeof ADDRESS_CLASSIFICATIONS)[number];

export const ADDRESS_CLASSIFICATION_LABELS: Record<
  AddressClassification,
  { ar: string; en: string; public: boolean }
> = {
  private_residence: { ar: "سكن خاص", en: "Private residence", public: false },
  business_shop: { ar: "نشاط تجاري أو متجر", en: "Business or shop", public: true },
  office: { ar: "مكتب", en: "Office", public: true },
  government_institution: { ar: "جهة حكومية", en: "Government institution", public: true },
  healthcare_facility: { ar: "منشأة صحية", en: "Healthcare facility", public: true },
  hotel_accommodation: { ar: "فندق أو مكان إقامة", en: "Hotel or accommodation", public: true },
  building_residential_complex: {
    ar: "مبنى أو مجمع سكني",
    en: "Building or residential complex",
    public: true,
  },
  warehouse_industrial: {
    ar: "مستودع أو منشأة صناعية",
    en: "Warehouse or industrial facility",
    public: true,
  },
};

export const COMMERCIAL_CLASSIFICATIONS = ADDRESS_CLASSIFICATIONS.filter(
  (value) => value !== "private_residence" && value !== "building_residential_complex",
);

export function isPublicClassification(value: AddressClassification) {
  return ADDRESS_CLASSIFICATION_LABELS[value].public;
}

export function isCommercialClassification(value: AddressClassification) {
  return value !== "private_residence" && value !== "building_residential_complex";
}

const COMMERCIAL_TERMS = [
  "شركة", "متجر", "مطعم", "فندق", "عيادة", "مكتب", "صيدلية", "مصنع", "مستودع",
  "company", "shop", "store", "restaurant", "hotel", "clinic", "office", "pharmacy", "factory", "warehouse",
];

export function commercialContentSignals(input: {
  name?: string | null;
  category?: string | null;
  openingHours?: string | null;
  phone?: string | null;
  website?: string | null;
}) {
  const text = `${input.name ?? ""} ${input.category ?? ""}`.toLocaleLowerCase();
  const reasons: string[] = [];
  if (COMMERCIAL_TERMS.some((term) => text.includes(term))) reasons.push("commercial_term");
  if (input.category?.trim()) reasons.push("business_category");
  if (input.openingHours?.trim()) reasons.push("opening_hours");
  if (input.phone?.trim()) reasons.push("public_phone");
  if (input.website?.trim()) reasons.push("website");
  return [...new Set(reasons)];
}