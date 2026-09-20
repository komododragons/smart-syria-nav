import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { PLACE_CATEGORY_VALUES, RESIDENTIAL_NODE_TYPES } from "./place-categories";

export type PublicPlace = {
  id: string;
  kind: "business" | "site";
  name: string;
  category: string;
  code: string | null;
  governorate: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  verification_level: string;
  phone: string | null;
  opening_hours: string | null;
};

const categoryEnum = z.enum(PLACE_CATEGORY_VALUES as [string, ...string[]]);

/**
 * Public place directory. Reads only publicly published rows; residential node
 * types are filtered out a second time in code so a mis-flagged private home
 * can never surface here.
 */
export const listPublicPlaces = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        category: categoryEnum.optional(),
        governorate: z.string().max(60).optional(),
        query: z.string().max(120).optional(),
        limit: z.number().int().min(1).max(100).default(60),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { serverPublicClient } = await import("./addresses.server");
    const supa = serverPublicClient();
    const pattern = data.query && data.query.trim().length >= 2 ? `%${data.query.trim()}%` : null;

    let bizQuery = supa
      .from("businesses")
      .select(
        "id, name_ar, name_en, place_category, phone, opening_hours, verification_level, smart_addresses(code), location_nodes(node_type, governorate, city, neighborhood, street, landmark, latitude, longitude, visibility)",
      )
      .eq("is_published", true)
      .eq("is_archived", false)
      .not("place_category", "is", null)
      .limit(data.limit);
    if (data.category) bizQuery = bizQuery.eq("place_category", data.category);
    if (pattern) bizQuery = bizQuery.or(`name_ar.ilike.${pattern},name_en.ilike.${pattern}`);

    let siteQuery = supa
      .from("location_nodes")
      .select(
        "id, display_name, node_type, place_category, governorate, city, neighborhood, street, landmark, latitude, longitude, verification_level, smart_addresses(code, is_public)",
      )
      .eq("visibility", "public")
      .eq("is_active", true)
      .not("place_category", "is", null)
      .limit(data.limit);
    if (data.category) siteQuery = siteQuery.eq("place_category", data.category);
    if (pattern)
      siteQuery = siteQuery.or(
        `display_name.ilike.${pattern},name_en.ilike.${pattern},neighborhood.ilike.${pattern},landmark.ilike.${pattern}`,
      );

    const [bizRes, siteRes] = await Promise.all([bizQuery, siteQuery]);

    const first = <T,>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

    const places: PublicPlace[] = [];

    for (const biz of bizRes.data ?? []) {
      const node = first(biz.location_nodes as never) as
        | { node_type: string; governorate: string | null; city: string | null; neighborhood: string | null; street: string | null; landmark: string | null; latitude: number | null; longitude: number | null; visibility: string }
        | null;
      if (node && (node.visibility !== "public" || RESIDENTIAL_NODE_TYPES.includes(node.node_type))) continue;
      if (data.governorate && node?.governorate !== data.governorate) continue;
      places.push({
        id: biz.id,
        kind: "business",
        name: biz.name_ar,
        category: biz.place_category as string,
        code: (first(biz.smart_addresses as never) as { code: string } | null)?.code ?? null,
        governorate: node?.governorate ?? null,
        city: node?.city ?? null,
        neighborhood: node?.neighborhood ?? null,
        street: node?.street ?? null,
        landmark: node?.landmark ?? null,
        latitude: node?.latitude ?? null,
        longitude: node?.longitude ?? null,
        verification_level: biz.verification_level,
        phone: biz.phone,
        opening_hours: biz.opening_hours,
      });
    }

    for (const site of siteRes.data ?? []) {
      if (RESIDENTIAL_NODE_TYPES.includes(site.node_type)) continue;
      if (data.governorate && site.governorate !== data.governorate) continue;
      const codes = (site.smart_addresses ?? []) as { code: string; is_public: boolean }[];
      places.push({
        id: site.id,
        kind: "site",
        name: site.display_name,
        category: site.place_category as string,
        code: codes.find((c) => c.is_public)?.code ?? null,
        governorate: site.governorate,
        city: site.city,
        neighborhood: site.neighborhood,
        street: site.street,
        landmark: site.landmark,
        latitude: site.latitude,
        longitude: site.longitude,
        verification_level: site.verification_level,
        phone: null,
        opening_hours: null,
      });
    }

    const rank = (p: PublicPlace) =>
      (p.verification_level === "unverified" ? 0 : 1) + (p.code ? 1 : 0);
    places.sort((a, b) => rank(b) - rank(a) || a.name.localeCompare(b.name, "ar"));

    const counts: Record<string, number> = {};
    for (const p of places) counts[p.category] = (counts[p.category] ?? 0) + 1;

    return { places: places.slice(0, data.limit), counts };
  });

/** Category totals across the whole public network, for the directory landing. */
export const placeCategoryCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { serverPublicClient } = await import("./addresses.server");
  const supa = serverPublicClient();
  const [biz, sites] = await Promise.all([
    supa
      .from("businesses")
      .select("place_category")
      .eq("is_published", true)
      .eq("is_archived", false)
      .not("place_category", "is", null)
      .limit(2000),
    supa
      .from("location_nodes")
      .select("place_category, node_type")
      .eq("visibility", "public")
      .eq("is_active", true)
      .not("place_category", "is", null)
      .limit(2000),
  ]);

  const counts: Record<string, number> = {};
  for (const row of biz.data ?? []) {
    const key = row.place_category as string;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  for (const row of sites.data ?? []) {
    if (RESIDENTIAL_NODE_TYPES.includes(row.node_type)) continue;
    const key = row.place_category as string;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
});
