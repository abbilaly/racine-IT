"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ImagePlus, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import type { HomepageBanner } from "@/lib/server/banners";

type Draft = {
  id: string | null;
  title: string;
  kicker: string;
  subtitle: string;
  imagePath: string;
  ctaLabel: string;
  ctaHref: string;
  position: number;
  isActive: boolean;
};

const EMPTY: Draft = {
  id: null,
  title: "",
  kicker: "",
  subtitle: "",
  imagePath: "",
  ctaLabel: "Shop now",
  ctaHref: "/shop",
  position: 0,
  isActive: true
};

function draftFrom(banner: HomepageBanner): Draft {
  return {
    id: banner.id,
    title: banner.title,
    kicker: banner.kicker,
    subtitle: banner.subtitle,
    imagePath: banner.image_path,
    ctaLabel: banner.cta_label,
    ctaHref: banner.cta_href,
    position: banner.position,
    isActive: banner.is_active
  };
}

export function BannersManager({
  initial,
  available
}: {
  initial: HomepageBanner[];
  available: boolean;
}) {
  const router = useRouter();
  const [banners, setBanners] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(current => (current ? { ...current, [key]: value } : current));

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/catalogue/images?kind=homepage-banner", {
        method: "POST",
        body
      });
      const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !data.path) {
        setError(data.error ?? "The banner image could not be uploaded.");
        return;
      }
      update("imagePath", data.path);
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/banners", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "The banner could not be saved.");
        return;
      }
      setNotice(draft.id ? "Banner updated." : "Banner created.");
      setDraft(null);
      const refreshed = await fetch("/api/admin/banners").then(r => r.json()).catch(() => null);
      if (refreshed?.rows) setBanners(refreshed.rows as HomepageBanner[]);
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(banner: HomepageBanner) {
    if (!window.confirm(`Delete the banner “${banner.title}”? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/banners?id=${encodeURIComponent(banner.id)}`, {
        method: "DELETE"
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "The banner could not be deleted.");
        return;
      }
      setBanners(rows => rows.filter(row => row.id !== banner.id));
      setNotice("Banner deleted.");
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function move(banner: HomepageBanner, direction: -1 | 1) {
    const next = banners
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((row, index) => ({ row, index }));
    const index = next.findIndex(entry => entry.row.id === banner.id);
    const target = next[index + direction];
    if (!target) return;
    const a = { ...banner, position: target.index };
    const b = { ...target.row, position: index };
    setBusy(true);
    try {
      await Promise.all(
        [a, b].map(row =>
          fetch("/api/admin/banners", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: row.id,
              title: row.title,
              kicker: row.kicker,
              subtitle: row.subtitle,
              imagePath: row.image_path,
              ctaLabel: row.cta_label,
              ctaHref: row.cta_href,
              isActive: row.is_active,
              position: row.position
            })
          })
        )
      );
      setBanners(rows =>
        rows
          .map(row =>
            row.id === a.id ? { ...row, position: a.position } : row.id === b.id ? { ...row, position: b.position } : row
          )
          .sort((x, y) => x.position - y.position)
      );
      router.refresh();
    } catch {
      setError("The order could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  if (!available) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
        <h2 className="m-0 text-[14px] font-semibold text-foreground">Banner storage is not ready</h2>
        <p className="m-0 mt-1 max-w-[70ch] text-[13px] text-muted-foreground">
          The homepage still uses its built-in hero slides. To manage banners from here, apply
          migration <code className="rounded bg-muted px-1 py-0.5 text-[12px]">0009_homepage_banners.sql</code>{" "}
          after approval; this screen becomes active as soon as the table exists.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[12px] text-muted-foreground">
          {banners.length} banner{banners.length === 1 ? "" : "s"} · shown on the homepage in display order
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft({ ...EMPTY, position: banners.length });
            setNotice(null);
            setError(null);
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus size={14} aria-hidden="true" /> New banner
        </button>
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="m-0 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-600 dark:text-emerald-400">
          {notice}
        </p>
      )}

      {draft && (
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-[14px] font-semibold text-foreground">
              {draft.id ? "Edit banner" : "New banner"}
            </h2>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Close banner editor"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[12px] font-medium text-foreground">
              Title *
              <input
                value={draft.title}
                onChange={e => update("title", e.target.value)}
                maxLength={120}
                required
                className="h-8 rounded-md border border-input bg-background px-2 text-[13px] font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-medium text-foreground">
              Kicker
              <input
                value={draft.kicker}
                onChange={e => update("kicker", e.target.value)}
                maxLength={60}
                placeholder="WELCOME TO AB TECH"
                className="h-8 rounded-md border border-input bg-background px-2 text-[13px] font-normal"
              />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1 text-[12px] font-medium text-foreground">
              Description
              <input
                value={draft.subtitle}
                onChange={e => update("subtitle", e.target.value)}
                maxLength={300}
                className="h-8 rounded-md border border-input bg-background px-2 text-[13px] font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-medium text-foreground">
              Button label
              <input
                value={draft.ctaLabel}
                onChange={e => update("ctaLabel", e.target.value)}
                maxLength={40}
                className="h-8 rounded-md border border-input bg-background px-2 text-[13px] font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-medium text-foreground">
              Destination
              <input
                value={draft.ctaHref}
                onChange={e => update("ctaHref", e.target.value)}
                maxLength={500}
                placeholder="/shop?category=smartphones"
                className="h-8 rounded-md border border-input bg-background px-2 text-[13px] font-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-medium text-foreground">
              Display order
              <input
                type="number"
                min={0}
                max={999}
                value={draft.position}
                onChange={e => update("position", Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-background px-2 text-[13px] font-normal"
              />
            </label>
            <label className="flex items-center gap-2 self-end text-[12px] font-medium text-foreground">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={e => update("isActive", e.target.checked)}
              />
              Visible on the homepage
            </label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr] sm:items-start">
            <div className="relative grid aspect-[16/9] place-items-center overflow-hidden rounded-md border border-border bg-muted">
              {draft.imagePath ? (
                <Image src={draft.imagePath} alt="Banner preview" fill sizes="200px" className="object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                  <ImagePlus size={18} aria-hidden="true" /> No image
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent">
                <Upload size={13} aria-hidden="true" />
                {uploading ? "Uploading…" : draft.imagePath ? "Replace image" : "Upload image"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  disabled={uploading}
                  onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <p className="m-0 text-[11px] text-muted-foreground">
                Wide images work best (about 16:9). JPEG, PNG, WebP or AVIF up to 3 MB.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || uploading || !draft.title || !draft.imagePath}
              className="h-8 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Saving…" : draft.id ? "Save banner" : "Create banner"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {banners.length === 0 ? (
        <p className="m-0 rounded-xl border border-dashed border-border bg-card p-6 text-center text-[13px] text-muted-foreground">
          No banners yet. The homepage currently shows its built-in slides. Create a banner to replace them.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {banners
            .slice()
            .sort((a, b) => a.position - b.position)
            .map(banner => (
              <li
                key={banner.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"
              >
                <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-md bg-muted sm:w-[132px]">
                  <Image src={banner.image_path} alt="" fill sizes="132px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-foreground">{banner.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        banner.is_active
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {banner.is_active ? "Visible" : "Hidden"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">#{banner.position}</span>
                  </div>
                  {banner.kicker && (
                    <p className="m-0 mt-0.5 truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                      {banner.kicker}
                    </p>
                  )}
                  {banner.subtitle && (
                    <p className="m-0 mt-0.5 truncate text-[12px] text-muted-foreground">{banner.subtitle}</p>
                  )}
                  <p className="m-0 mt-0.5 truncate text-[11px] text-muted-foreground">
                    {banner.cta_label} → {banner.cta_href}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void move(banner, -1)}
                    disabled={busy}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    aria-label={`Move ${banner.title} up`}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void move(banner, 1)}
                    disabled={busy}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    aria-label={`Move ${banner.title} down`}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(draftFrom(banner));
                      setNotice(null);
                      setError(null);
                    }}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`Edit ${banner.title}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(banner)}
                    disabled={busy}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label={`Delete ${banner.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
