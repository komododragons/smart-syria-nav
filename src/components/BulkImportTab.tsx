import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, Download, FileSpreadsheet, Upload } from "lucide-react";

import {
  commitBulkImport,
  IMPORT_COLUMNS,
  validateBulkImport,
  type PreviewRow,
} from "@/lib/bulk-import.functions";
import { orgLocations } from "@/lib/orgs.functions";

const card = "rounded-2xl border border-border bg-surface p-4 shadow-sm";
const primaryBtn =
  "flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50";
const ghostBtn =
  "flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold disabled:opacity-50";

type Row = Record<string, string | number | null>;

function parseCsv(content: string): Row[] {
  const text = content.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";") {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      rows.push(record);
      record = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || record.length) {
    record.push(field);
    rows.push(record);
  }
  const header = (rows.shift() ?? []).map((h) => h.trim());
  return rows
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["\uFEFF" + content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: (string | number | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const v = cell == null ? "" : String(cell);
          return /[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    )
    .join("\n");
}

export function BulkImportTab({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const validate = useServerFn(validateBulkImport);
  const commit = useServerFn(commitBulkImport);
  const listLocations = useServerFn(orgLocations);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{
    total: number;
    valid: number;
    duplicates: number;
    errors: number;
    rows: PreviewRow[];
  } | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [result, setResult] = useState<{
    created: { line: number; name: string; code: string }[];
    failed: { line: number; name: string; error: string }[];
  } | null>(null);

  async function readFile(file: File) {
    setBusy(true);
    setResult(null);
    try {
      let rows: Row[];
      if (/\.csv$/i.test(file.name)) {
        rows = parseCsv(await file.text());
      } else {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheetName = wb.SheetNames[0];
        const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
        if (!sheet) throw new Error("empty");
        rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
      }
      if (!rows.length) {
        toast.error("الملف فارغ");
        return;
      }
      if (rows.length > 2000) {
        toast.error("الحد الأقصى 2000 سطر في الملف الواحد");
        return;
      }
      setFileName(file.name);
      const res = await validate({ data: { organization_id: orgId, rows } });
      setPreview(res);
      toast.success(`تمت قراءة ${res.total} سطراً`);
    } catch {
      toast.error("تعذر قراءة الملف — تأكد أنه CSV أو XLSX صالح");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!preview) return;
    const chosen = preview.rows.filter(
      (r) => r.data && (r.status === "valid" || (includeDuplicates && r.status === "duplicate")),
    );
    if (!chosen.length) {
      toast.error("لا توجد أسطر صالحة للاستيراد");
      return;
    }
    setBusy(true);
    try {
      const created: { line: number; name: string; code: string }[] = [];
      const failed: { line: number; name: string; error: string }[] = [];
      for (let i = 0; i < chosen.length; i += 100) {
        const chunk = chosen.slice(i, i + 100).map((r) => ({ line: r.line, data: r.data! }));
        const res = await commit({ data: { organization_id: orgId, rows: chunk, is_published: true } });
        created.push(...res.created);
        failed.push(...res.failed);
      }
      setResult({ created, failed });
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["org-locations", orgId] });
      toast.success(`تم إنشاء ${created.length} عنواناً ذكياً`);
    } catch {
      toast.error("تعذر إتمام الاستيراد");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const headers = IMPORT_COLUMNS.map((c) => c.key);
    const sample = [
      "مخبز الشام",
      "فرع المزة",
      "دمشق",
      "دمشق",
      "المزة",
      "شارع الجلاء",
      "33.510000",
      "36.278000",
      "12",
      "المدخل الرئيسي",
      "0991234567",
      "مخابز",
      "مقابل الحديقة",
      "08:00-22:00",
    ];
    downloadFile("syriasan-import-template.csv", toCsv([headers, sample]));
  }

  function downloadErrors() {
    if (!preview) return;
    const rows: (string | number | null)[][] = [["line", "name", "status", "issue"]];
    for (const r of preview.rows) {
      if (r.status === "valid") continue;
      rows.push([r.line, r.raw_name, r.status, r.errors.join(" / ") || r.duplicate_of || ""]);
    }
    downloadFile("syriasan-import-issues.csv", toCsv(rows));
  }

  async function exportLocations() {
    setBusy(true);
    try {
      const res = await listLocations({ data: { organization_id: orgId, include_archived: true } });
      const origin = typeof window === "undefined" ? "https://syriasan.com" : window.location.origin;
      const rows: (string | number | null)[][] = [
        [
          "syriasan_code",
          "qr_url",
          "delivery_url",
          "business_name",
          "branch_name",
          "governorate",
          "city",
          "district",
          "neighborhood",
          "street",
          "building",
          "landmark",
          "latitude",
          "longitude",
          "phone",
          "category",
          "verification_level",
          "archived",
        ],
      ];
      for (const loc of res.locations) {
        const node = loc.node;
        rows.push([
          loc.smart_code ?? "",
          loc.smart_code ? `${origin}/a/${loc.smart_code}` : "",
          loc.smart_code ? `${origin}/d/${loc.smart_code}` : "",
          loc.name_ar,
          loc.branch_label ?? "",
          node?.governorate ?? "",
          node?.city ?? "",
          node?.district ?? "",
          node?.neighborhood ?? "",
          node?.street ?? "",
          node?.building_number ?? "",
          node?.landmark ?? "",
          node?.latitude ?? "",
          node?.longitude ?? "",
          loc.phone ?? "",
          loc.category ?? "",
          loc.verification_level,
          loc.is_archived ? "yes" : "no",
        ]);
      }
      downloadFile(`syriasan-locations-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
      toast.success(`تم تصدير ${res.locations.length} موقعاً`);
    } catch {
      toast.error("تعذر التصدير");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <FileSpreadsheet className="size-4 text-primary" /> استيراد المواقع دفعة واحدة
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          ارفع ملف CSV أو XLSX يحوي فروعك. الأعمدة المدعومة:{" "}
          {IMPORT_COLUMNS.map((c) => `${c.ar}${c.required ? "*" : ""}`).join(" · ")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={primaryBtn}
            disabled={busy || !canManage}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-3.5" /> اختر ملفاً
          </button>
          <button type="button" className={ghostBtn} onClick={downloadTemplate}>
            <Download className="size-3.5" /> تنزيل قالب جاهز
          </button>
          <button type="button" className={ghostBtn} disabled={busy} onClick={() => void exportLocations()}>
            <Download className="size-3.5" /> تصدير الرموز وروابط QR
          </button>
        </div>
        {!canManage ? (
          <p className="mt-2 text-xs text-warning">تحتاج صلاحية مسؤول مواقع أو أعلى للاستيراد.</p>
        ) : null}
        {fileName ? <p className="mt-2 text-xs text-muted-foreground">الملف: {fileName}</p> : null}
      </section>

      {preview ? (
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">معاينة قبل التأكيد</h3>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-full bg-success/15 px-2 py-1 text-success">صالح: {preview.valid}</span>
              <span className="rounded-full bg-warning/15 px-2 py-1 text-warning">
                مكرر: {preview.duplicates}
              </span>
              <span className="rounded-full bg-destructive/15 px-2 py-1 text-destructive">
                أخطاء: {preview.errors}
              </span>
            </div>
          </div>

          <div className="mt-3 max-h-96 overflow-auto rounded-xl border border-border">
            <table className="w-full text-right text-xs">
              <thead className="sticky top-0 bg-muted/60 text-[11px]">
                <tr>
                  <th className="p-2 font-bold">السطر</th>
                  <th className="p-2 font-bold">الاسم</th>
                  <th className="p-2 font-bold">الموقع</th>
                  <th className="p-2 font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.line} className="border-t border-border/60">
                    <td className="p-2 font-mono text-[11px] text-muted-foreground">{row.line}</td>
                    <td className="p-2">{row.raw_name}</td>
                    <td className="p-2 text-muted-foreground">
                      {row.data
                        ? `${row.data.governorate}${row.data.city ? ` — ${row.data.city}` : ""} (${row.data.latitude.toFixed(5)}, ${row.data.longitude.toFixed(5)})`
                        : "—"}
                    </td>
                    <td className="p-2">
                      {row.status === "valid" ? (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="size-3.5" /> جاهز
                        </span>
                      ) : row.status === "duplicate" ? (
                        <span className="text-warning">{row.duplicate_of}</span>
                      ) : (
                        <span className="flex items-start gap-1 text-destructive">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {row.errors.join(" / ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={includeDuplicates}
              onChange={(e) => setIncludeDuplicates(e.target.checked)}
            />
            استورد المكررات أيضاً ({preview.duplicates})
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={primaryBtn} disabled={busy} onClick={() => void runImport()}>
              <CheckCircle2 className="size-3.5" /> تأكيد الاستيراد وتوليد الرموز
            </button>
            <button type="button" className={ghostBtn} onClick={downloadErrors}>
              <Download className="size-3.5" /> تنزيل تقرير الأخطاء
            </button>
            <button type="button" className={ghostBtn} onClick={() => setPreview(null)}>
              إلغاء
            </button>
          </div>
        </section>
      ) : null}

      {result ? (
        <section className={card}>
          <h3 className="text-sm font-bold">نتيجة الاستيراد</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            تم إنشاء {result.created.length} عنواناً ذكياً، وفشل {result.failed.length}.
          </p>
          {result.created.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={ghostBtn}
                onClick={() => {
                  const origin = window.location.origin;
                  downloadFile(
                    "syriasan-imported-codes.csv",
                    toCsv([
                      ["syriasan_code", "name", "qr_url"],
                      ...result.created.map((c) => [c.code, c.name, `${origin}/a/${c.code}`]),
                    ]),
                  );
                }}
              >
                <Download className="size-3.5" /> تنزيل الرموز الجديدة
              </button>
              <button
                type="button"
                className={ghostBtn}
                onClick={() => {
                  void navigator.clipboard.writeText(result.created.map((c) => c.code).join("\n"));
                  toast.success("تم نسخ الرموز");
                }}
              >
                <Copy className="size-3.5" /> نسخ الرموز
              </button>
            </div>
          ) : null}
          <ul className="mt-3 grid gap-1 text-xs">
            {result.created.slice(0, 50).map((c) => (
              <li key={c.code} className="flex items-center justify-between gap-2 border-b border-border/60 py-1">
                <span>{c.name}</span>
                <span className="font-mono text-primary">{c.code}</span>
              </li>
            ))}
            {result.failed.map((f) => (
              <li key={`f-${f.line}`} className="py-1 text-destructive">
                السطر {f.line} — {f.name}: {f.error}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
