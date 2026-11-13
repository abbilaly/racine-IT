"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export function AdminSpinner() {
  return (
    <div className="admin-spinner" role="status">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" opacity="0.25" />
        <path d="M12 2a10 10 0 0 1 10 10" />
      </svg>
      <span>Loading…</span>
    </div>
  );
}

export function AdminEmptyState({ icon, title, description }: { icon?: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="admin-empty">
      {icon && <div className="admin-empty-icon">{icon}</div>}
      <h3 className="admin-empty-title">{title}</h3>
      {description && <p className="admin-empty-description">{description}</p>}
    </div>
  );
}

export function AdminError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="admin-error">
      <div className="admin-error-icon">⚠️</div>
      <p className="admin-error-message">{message}</p>
      {onRetry && (
        <button className="admin-error-retry" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function AdminBadge({ children, variant }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" }) {
  return <span className={`admin-badge admin-badge--${variant ?? "default"}`}>{children}</span>;
}

export function AdminBadgeStatus({ status }: { status: string }) {
  const variant = status === "delivered" || status === "active" || status === "accepted" ? "success" :
    status === "processing" || status === "pending" || status === "sent" ? "warning" :
    status === "cancelled" || status === "rejected" || status === "failed" ? "danger" :
    "default";
  return <AdminBadge variant={variant}>{status}</AdminBadge>;
}

interface AdminTableProps<T> {
  columns: Array<{ key: string; label: string; render?: (row: T) => React.ReactNode }>;
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
}

export function AdminTable<T>({ columns, rows, onRowClick, emptyMessage = "No data yet.", loading }: AdminTableProps<T>) {
  if (loading) return <AdminSpinner />;
  if (rows.length === 0) return <AdminEmptyState title={emptyMessage} />;

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className={onRowClick ? "clickable" : ""} onClick={() => onRowClick?.(row)}>
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row) : (row as any)[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function AdminPagination({ page, totalPages, totalItems, onPageChange }: AdminPaginationProps) {
  const start = (page - 1) * 50 + 1;
  const end = Math.min(page * 50, totalItems);

  return (
    <div className="admin-pagination">
      <span className="admin-pagination-info">
        Showing {start}–{end} of {totalItems} results
      </span>
      <div className="admin-pagination-controls">
        <button
          className="admin-pagination-btn"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
          const pageNum = i + 1;
          return (
            <button
              key={pageNum}
              className={`admin-pagination-btn ${pageNum === page ? "active" : ""}`}
              onClick={() => onPageChange(pageNum)}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          className="admin-pagination-btn"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

interface AdminPagerProps {
  page: number;
  totalPages: number;
  totalItems: number;
  params?: Record<string, string | undefined>;
}

export function AdminPager({ page, totalPages, totalItems, params }: AdminPagerProps) {
  const goTo = (newPage: number) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) qs.set(key, value);
    }
    qs.set("page", String(newPage));
    window.location.search = qs.toString();
  };
  return <AdminPagination page={page} totalPages={totalPages} totalItems={totalItems} onPageChange={goTo} />;
}

export function AdminSearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="admin-search">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search..."}
        className="admin-search-input"
      />
    </div>
  );
}
