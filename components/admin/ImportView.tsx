"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Loader2,
  Upload,
  X
} from "lucide-react";
import { Button } from "@/components/admin/ui/button";
import { TablePageHeader } from "@/components/admin/tables/page-header";
import { TableCard, TableScroll, Table, THead, TBody, Th, Tr, Td } from "@/components/admin/tables/table";

/** Row shape returned by POST /api/admin/products/import (preview). */
type PreviewRow = {
  slug: string;
  title: string;
  category: string;
  brand: string;
  price: string;
  compare_at_price: string;
  stock: number;
  badge: string | null;
  short_description: string;
  description: string;
  is_active: boolean;
  errors: string[];
  matched_category: string | null;
  matched_brand: string | null;
  suggested_slug: string;
};

type PreviewResponse = {
  preview: PreviewRow[];
  total_rows: number;
  preview_rows: number;
  has_error_rows: boolean;
  error?: string;
};

type ApplyRowResult = {
  row: number;
  action: string;
  slug: string;
  ok: boolean;
  error?: string;
};

type ApplyResponse = {
  applied: number;
  failed: number;
  results: ApplyRowResult[];
  error?: string;
};

function RowChip({ row }: { row: PreviewRow }) {
  if (row.errors.length > 0) {
    return (
      <span className="inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
        {row.errors.length} issue{row.errors.length === 1 ? "" : "s"}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
      Ready
    </span>
  );
}

function SummaryTile({
  value,
  label,
  tone = "default"
}: {
  value: number | string;
  label: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const color =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "text-rose-600 dark:text-rose-400"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <p className={`m-0 text-[18px] font-semibold leading-none tabular-nums ${color}`}>{value}</p>
      <p className="m-0 mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function ImportView() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [applied, setApplied] = useState<ApplyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(null);
    setApplied(null);
    setError(null);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setApplied(null);
    setError(null);
  };

  const loadPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setApplied(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/products/import", { method: "POST", body: formData });
      const data = (await res.json()) as PreviewResponse;
      if (!res.ok) {
        setError(data.error || "Failed to read file.");
        return;
      }
      setPreview(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyImport = async () => {
    if (!preview || preview.preview.length === 0) {
      setError("Preview the file before applying it.");
      return;
    }
    setLoading(true);
    setError(null);

    const decisions = preview.preview.map(row => ({
      slug: row.slug || row.suggested_slug,
      title: row.title,
      category: row.category,
      brand: row.brand,
      price: Number(row.price),
      compare_at_price: row.compare_at_price ? Number(row.compare_at_price) : null,
      stock: row.stock,
      badge: row.badge,
      short_description: row.short_description,
      description: row.description,
      is_active: row.is_active,
      action: "create" as const
    }));

    try {
      const res = await fetch("/api/admin/products/import", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "apply", decisions })
      });
      const data = (await res.json()) as ApplyResponse;
      if (!res.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      setApplied(data);
      setPreview(null);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async () => {
    const link = document.createElement("a");
    link.href = "/api/admin/products/import?template=products";
    link.download = "product-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const readyRows = preview ? preview.preview_rows - preview.preview.filter(row => row.errors.length > 0).length : 0;
  const issueRows = preview ? preview.preview.filter(row => row.errors.length > 0).length : 0;
  const issues = preview
    ? preview.preview.flatMap((row, index) =>
        row.errors.map(message => ({ row: index + 1, title: row.title || row.slug, message }))
      )
    : [];
  const failedResults = applied ? applied.results.filter(result => !result.ok) : [];

  return (
    <div className="admin-page">
      <TablePageHeader
        title="Import products"
        subtitle="Upload a CSV file to add or update catalogue products"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={downloadTemplate} disabled={loading} type="button">
              <Download size={14} aria-hidden="true" />
              Download template
            </Button>
            <Button asChild size="sm">
              <a href="/admin/products">Back to products</a>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <TableCard className="p-4 xl:col-span-1">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="m-0 text-[14px] font-semibold text-foreground">Upload file</h2>
              <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">CSV, first row is the header</p>
            </div>
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              <Upload size={14} aria-hidden="true" />
            </span>
          </div>

          {!file ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center transition-colors hover:border-foreground/25 hover:bg-accent/40">
              <input type="file" accept=".csv" onChange={handleFileChange} className="sr-only" />
              <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                <Upload size={18} aria-hidden="true" />
              </span>
              <span className="text-[13px] font-medium text-foreground">Choose a file</span>
              <span className="text-[11px] text-muted-foreground">
                Column headers must match the template exactly.
              </span>
            </label>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-3">
              <FileText size={18} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[13px] font-medium text-foreground" title={file.name}>
                  {file.name}
                </p>
                <p className="m-0 mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                  {file.size.toLocaleString()} bytes
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded p-1 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Remove file"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={loadPreview} disabled={!file || loading}>
              {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
              Preview import
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyImport}
              disabled={!preview || loading || preview.preview.length === 0}
            >
              <Check size={14} aria-hidden="true" />
              Apply import
            </Button>
          </div>

          {file && !preview && !applied && (
            <p className="m-0 mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ChevronRight size={12} aria-hidden="true" />
              Preview first, then apply. Nothing is written until you apply.
            </p>
          )}

          {error && (
            <p className="m-0 mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive" role="alert">
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          {applied && failedResults.length === 0 && (
            <p className="m-0 mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700 dark:text-emerald-300" role="status">
              <Check size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              Imported {applied.applied} product{applied.applied === 1 ? "" : "s"}. The catalogue and
              inventory are updated.
            </p>
          )}
        </TableCard>

        <div className="flex flex-col gap-4 xl:col-span-2">
          {preview && (
            <TableCard className="p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="m-0 text-[14px] font-semibold text-foreground">Import preview</h2>
                  <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
                    {preview.total_rows} row{preview.total_rows === 1 ? "" : "s"} read from the file
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                  {preview.preview_rows} previewed
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <SummaryTile value={preview.total_rows} label="Rows in file" />
                <SummaryTile value={readyRows} label="Ready to import" tone="success" />
                <SummaryTile value={issueRows} label="Rows with issues" tone={issueRows > 0 ? "danger" : "default"} />
              </div>

              {issues.length > 0 && (
                <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                  <p className="m-0 flex items-center gap-1.5 text-[12px] font-medium text-destructive">
                    <AlertCircle size={13} aria-hidden="true" />
                    {issues.length} problem{issues.length === 1 ? "" : "s"} to fix
                  </p>
                  <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                    {issues.slice(0, 8).map((problem, index) => (
                      <li key={index} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                        <span className="font-medium tabular-nums text-foreground">Row {problem.row}</span>
                        <span className="max-w-[220px] truncate text-muted-foreground">{problem.title}</span>
                        <span className="text-destructive">{problem.message}</span>
                      </li>
                    ))}
                  </ul>
                  {issues.length > 8 && (
                    <p className="m-0 mt-2 text-[11px] text-muted-foreground">
                      … and {issues.length - 8} more; fix the file and preview again.
                    </p>
                  )}
                </div>
              )}
            </TableCard>
          )}

          {preview && preview.preview.length > 0 && (
            <TableCard>
              <TableScroll>
                <Table label="Import preview" tableId="import-preview" minWidth="min-w-[720px]">
                  <THead>
                    <Th className="w-10">#</Th>
                    <Th>Slug</Th>
                    <Th>Title</Th>
                    <Th className="hidden md:table-cell">Category</Th>
                    <Th className="text-right">Price</Th>
                    <Th className="text-right">Stock</Th>
                    <Th className="text-right">Status</Th>
                  </THead>
                  <TBody>
                    {preview.preview.map((row, index) => (
                      <Tr key={`${row.slug}-${index}`}>
                        <Td className="tabular-nums text-muted-foreground">{index + 1}</Td>
                        <Td className="font-mono text-[12px] text-muted-foreground">{row.slug || "—"}</Td>
                        <Td className="max-w-[260px] truncate font-medium text-foreground">{row.title || "—"}</Td>
                        <Td className="hidden text-muted-foreground md:table-cell">{row.category || "—"}</Td>
                        <Td className="text-right tabular-nums">${Number(row.price || 0).toFixed(2)}</Td>
                        <Td className="text-right tabular-nums">{row.stock}</Td>
                        <Td className="text-right">
                          <RowChip row={row} />
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
              {preview.has_error_rows && (
                <p className="m-0 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
                  Rows with issues are still sent, but the API rejects them individually; fix them first
                  for a clean run.
                </p>
              )}
            </TableCard>
          )}

          {applied && (
            <TableCard>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <h2 className="m-0 text-[14px] font-semibold text-foreground">Import result</h2>
                  <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
                    {applied.applied} applied · {applied.failed} failed
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    applied.failed > 0
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {applied.failed > 0 ? "Completed with errors" : "Completed"}
                </span>
              </div>
              <TableScroll>
                <Table label="Import result" tableId="import-result" minWidth="min-w-[560px]">
                  <THead>
                    <Th className="w-10">Row</Th>
                    <Th>Slug</Th>
                    <Th>Action</Th>
                    <Th className="text-right">Result</Th>
                  </THead>
                  <TBody>
                    {applied.results.map(result => (
                      <Tr key={`${result.row}-${result.slug}`}>
                        <Td className="tabular-nums text-muted-foreground">{result.row}</Td>
                        <Td className="font-mono text-[12px] text-muted-foreground">{result.slug || "—"}</Td>
                        <Td className="capitalize text-muted-foreground">{result.action}</Td>
                        <Td className="text-right">
                          {result.ok ? (
                            <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                              Saved
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300" title={result.error}>
                              Failed
                            </span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
            </TableCard>
          )}

          {!preview && !applied && (
            <TableCard className="grid place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
                  <FileText size={16} aria-hidden="true" />
                </span>
                <p className="m-0 mt-2 text-[13px] font-medium text-foreground">Nothing to preview yet</p>
                <p className="m-0 mt-0.5 text-[11px] text-muted-foreground">
                  Choose a file, then run a preview to see what will be created or updated.
                </p>
              </div>
            </TableCard>
          )}
        </div>
      </div>
    </div>
  );
}
