import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GOVERNORATES, normalizeArabic } from "./smart-address";

/** Accepted header names (Arabic + English) for each importable field. */
export const IMPORT_COLUMNS: { key: string; ar: string; aliases: string[]; required?: boolean }[] = [
  { key: "business_name", ar: "اسم النشاط", aliases: ["business_name", "name", "اسم", "اسم النشاط", "الاسم"], required: true },
  { key: "branch_name", ar: "اسم الفرع", aliases: ["branch_name", "branch", "الفرع", "اسم الفرع"] },
  { key: "governorate", ar: "المحافظة", aliases: ["governorate", "province", "المحافظة"], required: true },
  { key: "city", ar: "المدينة", aliases: ["city", "المدينة"] },
  { key: "district", ar: "المنطقة", aliases: ["district", "المنطقة"] },
  { key: "neighborhood", ar: "الحي", aliases: ["neighborhood", "الحي"] },
  { key: "street", ar: "الشارع", aliases: ["street", "الشارع"] },
  { key: "latitude", ar: "خط العرض", aliases: ["latitude", "lat", "خط العرض"], required: true },
  { key: "longitude", ar: "خط الطول", aliases: ["longitude", "lng", "lon", "long", "خط الطول"], required: true },
  { key: "building", ar: "رقم البناء", aliases: ["building", "building_number", "رقم البناء", "البناء"] },
  { key: "entrance", ar: "المدخل", aliases: ["entrance", "المدخل"] },
  { key: "phone", ar: "الهاتف", aliases: ["phone", "mobile", "الهاتف", "الجوال"] },
  { key: "category", ar: "التصنيف", aliases: ["category", "type", "التصنيف", "النشاط"] },
  { key: "landmark", ar: "معلم قريب", aliases: ["landmark", "معلم", "معلم قريب"] },
  { key: "opening_hours", ar: "ساعات العمل", aliases: ["opening_hours", "hours", "ساعات العمل"] },
];

export type PreparedRow = {
  name_ar: string;
  branch_label: string | null;
  governorate: string;
  governorate_code: string;
  city: string | null;
  district: string | null;
  neighborhood: string | null;
  street: string | null;
  landmark: string | null;
  building_number: string | null;
  entrance_name: string | null;
  phone: string | null;
  category: string | null;
  opening_hours: string | null;
  latitude: number;
  longitude: number;
};

export type PreviewRow = {
  line: number;
  status: "valid" | "duplicate" | "error";
  errors: string[];
  duplicate_of: string | null;
  data: PreparedRow | null;
  raw_name: string;
};

const rawRow = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

const preparedSchema = z.object({
  name_ar: z.string().min(2).max(160),
  branch_label: z.string().max(120).nullable(),
  governorate: z.string().min(2).max(80),
  governorate_code: z.string().min(2).max(4),
  city: z.string().max(80).nullable(),
  district: z.string().max(80).nullable(),
  neighborhood: z.string().max(120).nullable(),
  street: z.string().max(160).nullable(),
  landmark: z.string().max(160).nullable(),
  building_number: z.string().max(40).nullable(),
  entrance_name: z.string().max(160).nullable(),
  phone: z.string().max(40).nullable(),
  category: z.string().max(80).nullable(),
  opening_hours: z.string().max(200).nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

type Supa = {
  rpc: (fn: "org_role", args: { _org: string; _user: string }) => PromiseLike<{ data: unknown }>;
};

async function assertManager(supa: Supa, org: string, user: string) {
  const { data } = await supa.rpc("org_role", { _org: org, _user: user });
  const role = data as string | null;
  if (!role || !["owner", "admin", "manager"].includes(role)) throw new Error("forbidden");
  return role;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function pick(row: Record<string, unknown>, key: string): string {
  const column = IMPORT_COLUMNS.find((c) => c.key === key);
  const aliases = (column?.aliases ?? [key]).map((a) => a.toLowerCase());
  for (const [header, value] of Object.entries(row)) {
    if (aliases.includes(header.trim().toLowerCase())) {
      const v = text(value);
      if (v) return v;
    }
  }
  return "";
}

function resolveGovernorate(value: string): { ar: string; code: string } | null {
  const needle = normalizeArabic(value);
  const upper = value.trim().toUpperCase();
  const hit = GOVERNORATES.find((g) => g.code === upper || normalizeArabic(g.ar) === needle);
  return hit ? { ar: hit.ar, code: hit.code } : null;
}

function parseCoord(value: string): number | null {
  const n = Number(value.replace(/[^\d.\-+]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Validates uploaded rows, flags duplicates, and returns a preview without writing anything. */
export const validateBulkImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        rows: z.array(rawRow).min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.organization_id, context.userId);

    const { data: existing } = await context.supabase
      .from("businesses")
      .select("name_ar, branch_label, location_nodes(latitude, longitude)")
      .eq("organization_id", data.organization_id)
      .limit(5000);

    const existingKeys = new Set<string>();
    const existingPoints: { lat: number; lng: number; name: string }[] = [];
    for (const row of existing ?? []) {
      existingKeys.add(`${normalizeArabic(row.name_ar)}|${normalizeArabic(row.branch_label ?? "")}`);
      const node = Array.isArray(row.location_nodes) ? row.location_nodes[0] : row.location_nodes;
      if (node?.latitude != null && node.longitude != null) {
        existingPoints.push({ lat: node.latitude, lng: node.longitude, name: row.name_ar });
      }
    }

    const seen = new Map<string, number>();
    const batchPoints: { lat: number; lng: number; line: number }[] = [];
    const preview: PreviewRow[] = [];

    data.rows.forEach((raw, index) => {
      const line = index + 2; // header is line 1
      const row = raw as Record<string, unknown>;
      const errors: string[] = [];

      const name = pick(row, "business_name");
      const branch = pick(row, "branch_name");
      const gov = resolveGovernorate(pick(row, "governorate"));
      const lat = parseCoord(pick(row, "latitude"));
      const lng = parseCoord(pick(row, "longitude"));

      if (name.length < 2) errors.push("اسم النشاط مفقود أو قصير");
      if (!gov) errors.push("المحافظة غير معروفة");
      if (lat == null) errors.push("خط العرض غير صالح");
      else if (lat < 32 || lat > 38) errors.push("خط العرض خارج حدود سورية");
      if (lng == null) errors.push("خط الطول غير صالح");
      else if (lng < 35 || lng > 43) errors.push("خط الطول خارج حدود سورية");

      const phone = pick(row, "phone");
      if (phone && !/^[+\d][\d\s\-()]{5,25}$/.test(phone)) errors.push("رقم الهاتف غير صالح");

      if (errors.length || !gov || lat == null || lng == null) {
        preview.push({ line, status: "error", errors, duplicate_of: null, data: null, raw_name: name || "—" });
        return;
      }

      const key = `${normalizeArabic(name)}|${normalizeArabic(branch)}`;
      let duplicateOf: string | null = null;
      if (existingKeys.has(key)) duplicateOf = "موجود مسبقاً في الشركة (نفس الاسم والفرع)";
      const nearExisting = existingPoints.find((p) => metres(p, { lat, lng }) < 40);
      if (!duplicateOf && nearExisting) duplicateOf = `قريب جداً من موقع قائم: ${nearExisting.name}`;
      const firstLine = seen.get(key);
      if (!duplicateOf && firstLine) duplicateOf = `مكرر داخل الملف مع السطر ${firstLine}`;
      const nearBatch = batchPoints.find((p) => metres(p, { lat, lng }) < 40);
      if (!duplicateOf && nearBatch) duplicateOf = `إحداثيات مطابقة للسطر ${nearBatch.line}`;

      seen.set(key, firstLine ?? line);
      batchPoints.push({ lat, lng, line });

      const prepared: PreparedRow = {
        name_ar: name.slice(0, 160),
        branch_label: branch ? branch.slice(0, 120) : null,
        governorate: gov.ar,
        governorate_code: gov.code,
        city: pick(row, "city").slice(0, 80) || null,
        district: pick(row, "district").slice(0, 80) || null,
        neighborhood: pick(row, "neighborhood").slice(0, 120) || null,
        street: pick(row, "street").slice(0, 160) || null,
        landmark: pick(row, "landmark").slice(0, 160) || null,
        building_number: pick(row, "building").slice(0, 40) || null,
        entrance_name: pick(row, "entrance").slice(0, 160) || null,
        phone: phone.slice(0, 40) || null,
        category: pick(row, "category").slice(0, 80) || null,
        opening_hours: pick(row, "opening_hours").slice(0, 200) || null,
        latitude: lat,
        longitude: lng,
      };

      preview.push({
        line,
        status: duplicateOf ? "duplicate" : "valid",
        errors: [],
        duplicate_of: duplicateOf,
        data: prepared,
        raw_name: branch ? `${name} — ${branch}` : name,
      });
    });

    return {
      total: preview.length,
      valid: preview.filter((r) => r.status === "valid").length,
      duplicates: preview.filter((r) => r.status === "duplicate").length,
      errors: preview.filter((r) => r.status === "error").length,
      rows: preview,
    };
  });

/** Creates the confirmed locations and issues a Syriasan code for each one. */
export const commitBulkImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        organization_id: z.string().uuid(),
        rows: z.array(z.object({ line: z.number(), data: preparedSchema })).min(1).max(300),
        is_published: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.organization_id, context.userId);
    const { generateSmartCode } = await import("./addresses.server");
    const supa = context.supabase;

    const created: { line: number; name: string; code: string }[] = [];
    const failed: { line: number; name: string; error: string }[] = [];

    for (const item of data.rows) {
      const row = item.data;
      try {
        const { data: node, error: nodeErr } = await supa
          .from("location_nodes")
          .insert({
            node_type: "building",
            display_name: row.branch_label ? `${row.name_ar} — ${row.branch_label}` : row.name_ar,
            name_ar: row.name_ar,
            latitude: row.latitude,
            longitude: row.longitude,
            governorate: row.governorate,
            city: row.city,
            district: row.district,
            neighborhood: row.neighborhood,
            street: row.street,
            landmark: row.landmark,
            building_number: row.building_number,
            visibility: "public",
            verification_level: "user_confirmed",
            confidence_score: 50,
            created_by: context.userId,
          })
          .select("id")
          .single();
        if (nodeErr) throw new Error(nodeErr.message);

        let accessPointId: string | null = null;
        if (row.entrance_name) {
          const { data: ap, error: apErr } = await supa
            .from("access_points")
            .insert({
              node_id: node.id,
              access_type: "main_entrance",
              display_name: row.entrance_name,
              name_ar: row.entrance_name,
              latitude: row.latitude,
              longitude: row.longitude,
              accessibility: [],
              always_open: true,
              verification_level: "user_confirmed",
              confidence_score: 50,
              created_by: context.userId,
            })
            .select("id")
            .single();
          if (apErr) throw new Error(apErr.message);
          accessPointId = ap.id;
        }

        const code = await generateSmartCode(supa, row.governorate_code);
        const { data: smart, error: codeErr } = await supa
          .from("smart_addresses")
          .insert({
            code,
            node_id: node.id,
            default_access_point_id: accessPointId,
            label: row.branch_label ?? row.name_ar,
            is_public: true,
            created_by: context.userId,
          })
          .select("id, code")
          .single();
        if (codeErr) throw new Error(codeErr.message);

        const { data: biz, error: bizErr } = await supa
          .from("businesses")
          .insert({
            organization_id: data.organization_id,
            name_ar: row.name_ar,
            branch_label: row.branch_label,
            category: row.category,
            phone: row.phone,
            opening_hours: row.opening_hours,
            node_id: node.id,
            smart_address_id: smart.id,
            visitor_access_point_id: accessPointId,
            delivery_access_point_id: accessPointId,
            owner_id: context.userId,
            is_published: data.is_published,
          })
          .select("id")
          .single();
        if (bizErr) throw new Error(bizErr.message);

        await supa.from("audit_logs").insert({
          actor_id: context.userId,
          action: "org_location_imported",
          resource_type: "business",
          resource_id: biz.id,
          metadata: { organization_id: data.organization_id, code: smart.code, line: item.line },
        });

        created.push({
          line: item.line,
          name: row.branch_label ? `${row.name_ar} — ${row.branch_label}` : row.name_ar,
          code: smart.code,
        });
      } catch (error) {
        failed.push({
          line: item.line,
          name: row.name_ar,
          error: error instanceof Error ? error.message : "فشل غير معروف",
        });
      }
    }

    return { created, failed };
  });
