"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, AlertCircle, Check, X, Download, Eye, ChevronDown } from "lucide-react";
import { AdminSpinner, AdminEmptyState, AdminError } from "@/lib/server/admin-ui";

export function ImportView() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<"preview" | "apply">("preview");
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setPreview(null);
      setSummary(null);
      setError(null);
    }
  };

  const loadPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setSummary(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to read file.");
        return;
      }
      setPreview(data.plan);
      setSummary(data.summary);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const applyImport = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    if (!file) {
      setError("Choose a CSV file to import first.");
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("action", "apply");

    try {
      const res = await fetch("/api/admin/products/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed.");
        return;
      }
      setSummary(data.summary);
      setAction("apply");
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

  const headerRow = (row: any) => (
    <tr key={row.index} className={row.errors.length > 0 ? "admin-import-row--error" : ""}>
      <td className="admin-import-index">{row.index}</td>
      <td className="admin-import-sku">{row.sku || "—"}</td>
      <td className="admin-import-title">{row.title || "—"}</td>
      <td className="admin-import-category">{row.category || "—"}</td>
      <td className="admin-import-price">{row.price || "—"}</td>
      <td className="admin-import-stock">{row.stock || "—"}</td>
      <td className="admin-import-actions">
        {row.errors.length > 0 ? (
          <span className="admin-badge admin-badge--danger">{row.errors.length} issue{row.errors.length > 1 ? "s" : ""}</span>
        ) : row.action === "create" ? (
          <span className="admin-badge admin-badge--success">Create</span>
        ) : row.action === "update" ? (
          <span className="admin-badge admin-badge--warning">Update</span>
        ) : (
          <span className="admin-badge admin-badge--default">Skip</span>
        )}
      </td>
    </tr>
  );

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="admin-page-title">
          <h1>Import products</h1>
          <p className="admin-page-subtitle">Upload a CSV or XLSX file to add or update products</p>
        </div>
        <button
          className="btn-outline"
          onClick={downloadTemplate}
          disabled={loading}
          type="button"
        >
          <Download size={14} />
          Download template
        </button>
      </div>

      <div className="admin-import-layout">
        <section className="admin-card">
          <div className="admin-card-header">
            <h2>Upload file</h2>
          </div>

          <div className="admin-import-upload">
            {!file ? (
              <label className="admin-upload-dropzone">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  onChange={handleFileChange}
                  className="admin-upload-input"
                />
                <Upload size={32} className="admin-upload-icon" />
                <p className="admin-upload-text">Drop a CSV or XLSX file here, or click to browse</p>
                <p className="admin-upload-hint">The first row must contain the column headers exactly as in the template.</p>
              </label>
            ) : (
              <div className="admin-uploaded-file">
                <FileText size={24} className="admin-uploaded-icon" />
                <div className="admin-uploaded-info">
                  <p className="admin-uploaded-name">{fileName}</p>
                  <p className="admin-uploaded-hint">{file.size.toLocaleString()} bytes · CSV/XLSX</p>
                </div>
                <div className="admin-uploaded-actions">
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setFile(null);
                      setFileName("");
                      setPreview(null);
                      setSummary(null);
                      setError(null);
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>

          {file && (
            <div className="admin-import-controls">
              <button
                className="btn-dark"
                onClick={loadPreview}
                disabled={loading}
                type="button"
              >
                {loading ? <AdminSpinner /> : <><Eye size={14} /> Preview import</>}
              </button>
              <button
                className="btn-outline"
                onClick={applyImport}
                disabled={loading || !preview}
                type="button"
              >
                <Check size={14} />
                Apply import
              </button>
            </div>
          )}

          {error && (
            <div className="admin-form-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
        </section>

        {preview && (
          <section className="admin-card admin-card--wide">
            <div className="admin-card-header">
              <h2>Preview</h2>
              <span className="admin-chip">{summary?.total_rows ?? preview.length} rows</span>
            </div>

            <div className="admin-import-summary">
              <div className="admin-import-summary-block">
                <p className="admin-import-summary-value">{summary?.valid_rows ?? 0}</p>
                <p className="admin-import-summary-label">Valid rows</p>
              </div>
              <div className="admin-import-summary-block">
                <p className="admin-import-summary-value admin-import-summary-value--success">{summary?.created ?? 0}</p>
                <p className="admin-import-summary-label">New products</p>
              </div>
              <div className="admin-import-summary-block">
                <p className="admin-import-summary-value admin-import-summary-value--warning">{summary?.updated ?? 0}</p>
                <p className="admin-import-summary-label">Updates</p>
              </div>
              <div className="admin-import-summary-block">
                <p className="admin-import-summary-value admin-import-summary-value--danger">{summary?.invalid_rows ?? 0}</p>
                <p className="admin-import-summary-label">Rows with errors</p>
              </div>
            </div>

            {summary?.errors && summary.errors.length > 0 && (
              <div className="admin-import-errors">
                <h3 className="admin-import-errors-title">
                  <AlertCircle size={16} />
                  Errors
                </h3>
                <ul className="admin-import-error-list">
                  {summary.errors.slice(0, 50).map((err: any, index: number) => (
                    <li key={index} className="admin-import-error-item">
                      <span className="admin-import-error-row">Row {err.row}</span>
                      <span className="admin-import-error-field">{err.field}</span>
                      <span className="admin-import-error-message">{err.message}</span>
                    </li>
                  ))}
                </ul>
                {summary.errors.length > 50 && (
                  <p className="admin-import-error-more">
                    … and {summary.errors.length - 50} more error:summary.errors.length - 50 errors not shown.
                  </p>
                )}
              </div>
            )}

            <div className="admin-table-responsive">
              <table className="admin-table admin-table--small">
                <thead>
                  <tr>
                    <th scope="col" className="admin-import-index">#</th>
                    <th scope="col" className="admin-import-sku">SKU</th>
                    <th scope="col" className="admin-import-title">Title</th>
                    <th scope="col" className="admin-import-category">Category</th>
                    <th scope="col" className="admin-import-price">Price</th>
                    <th scope="col" className="admin-import-stock">Stock</th>
                    <th scope="col" className="admin-import-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(headerRow)}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {summary && summary.errors.length === 0 && summary.created + summary.updated > 0 && (
          <section className="admin-card">
            <div className="admin-card-header">
              <h2>Import complete</h2>
            </div>
            <div className="admin-import-result">
              <p className="admin-form-success">
                <Check size={16} />
                Imported {summary.created} new product{summary.created !== 1 ? "s" : ""} and updated {summary.updated} existing product{summary.updated !== 1 ? "s" : ""}.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
