import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Regional offline packages.
 *
 * The first implementation ships *address* packages, not full map datasets:
 * for a governorate we return the public smart addresses with the fields the
 * destination card needs, and the client stores them locally. The shape is
 * deliberately package-like (region + generated_at + entries) so a later
 * version can add tile/graph payloads behind the same download flow.
 */
export const REGION_PACKAGES = [
  { code: "DAM", ar: "دمشق", governorate: "دمشق" },
  { code: "RDA", ar: "ريف دمشق", governorate: "ريف دمشق" },
  { code: "ALP", ar: "حلب", governorate: "حلب" },
  { code: "HMS", ar: "حمص", governorate: "حمص" },
  { code: "HAM", ar: "حماة", governorate: "حماة" },
  { code: "LTK", ar: "اللاذقية", governorate: "اللاذقية" },
  { code: "TRT", ar: "طرطوس", governorate: "طرطوس" },
  { code: "DEZ", ar: "دير الزور", governorate: "دير الزور" },
  { code: "HSK", ar: "الحسكة", governorate: "الحسكة" },
  { code: "IDL", ar: "إدلب", governorate: "إدلب" },
  { code: "DRA", ar: "درعا", governorate: "درعا" },
  { code: "SWD", ar: "السويداء", governorate: "السويداء" },
  { code: "QUN", ar: "القنيطرة", governorate: "القنيطرة" },
  { code: "RAQ", ar: "الرقة", governorate: "الرقة" },
] as const;

export type RegionCode = (typeof REGION_PACKAGES)[number]["code"];

export type OfflineAddressEntry = {
  code: string;
  display_name: string;
  governorate: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  verification_level: string;
  confidence_score: number;
};

export const fetchRegionPackage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        region: z.string().min(2).max(8),
        limit: z.number().int().min(10).max(500).default(300),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const region = REGION_PACKAGES.find((r) => r.code === data.region);
    if (!region) throw new Error("منطقة غير معروفة");

    const { serverPublicClient } = await import("./addresses.server");
    const supa = serverPublicClient();

    // Public addresses only — private residential data is never packaged.
    const { data: rows, error } = await supa
      .from("smart_addresses")
      .select(
        "code, location_nodes!inner(display_name, governorate, city, neighborhood, street, landmark, latitude, longitude, verification_level, confidence_score, visibility, is_active)",
      )
      .eq("is_public", true)
      .eq("status", "active")
      .eq("location_nodes.visibility", "public")
      .eq("location_nodes.is_active", true)
      .eq("location_nodes.governorate", region.governorate)
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const entries: OfflineAddressEntry[] = (rows ?? []).flatMap((row) => {
      const node = row.location_nodes as unknown as OfflineAddressEntry | null;
      if (!node) return [];
      return [
        {
          code: row.code,
          display_name: node.display_name,
          governorate: node.governorate,
          city: node.city,
          neighborhood: node.neighborhood,
          street: node.street,
          landmark: node.landmark,
          latitude: node.latitude,
          longitude: node.longitude,
          verification_level: node.verification_level,
          confidence_score: node.confidence_score,
        },
      ];
    });

    return {
      region: region.code,
      region_ar: region.ar,
      generated_at: new Date().toISOString(),
      entries,
    };
  });
