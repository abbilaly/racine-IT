"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Monitor,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  Upload,
  X
} from "lucide-react";
import type { FocusOption, HomepageBanner } from "@/lib/server/banners";

type Draft = {
  id: string | null;
  title: string;
  kicker: string;
  subtitle: string;
  imagePath: string;
  mobileImagePath: string;
  focusDesktop: FocusOption;
  focusMobile: FocusOption;
  ctaLabel: string;
  ctaHref: string;
  position: number;
  isActive: boolean;
};

const FOCUS: { value: FocusOption; label: string }[] = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" }
];

const EMPTY: Draft = {
  id: null,
  title: "",
  kicker: "",
  subtitle: "",
  imagePath: "",
  mobileImagePath: "",
  focusDesktop: "center",
  focusMobile: "center",
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
    mobileImagePath: banner.mobile_image_path ?? "",
    focusDesktop: (banner.focus_desktop ?? "center") as FocusOption,
    focusMobile: (banner.focus_mobile ?? "center") as FocusOption,
    ctaLabel: banner.cta_label,
    ctaHref: banner.cta_href,
    position: banner.position,
    isActive: banner.is_active
  };
}

/**
 * Homepage banner CMS.
 *
 * Beyond the original single-image editor this provides the responsive fields
 * the storefront now reads: a dedicated mobile image (optional), a focal point
 * per breakpoint, and a desktop/mobile preview so the owner can check text
 * readability and CTA visibility before publishing. When migration 0010 is not
 * applied the responsive fields are shown as unavailable instead of pretending
 * to save them.
 */
export function BannersManager({
  initial,
  available,
  responsive = true
}: {
  initial: HomepageBanner[];
  available: boolean;
  responsive?: boolean;
}) {
  const router = useRouter();
  const [banners, setBanners] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<"desktop" | "mobile">("desktop");
  const [uploading, setUploading] = useState<"desktop" | "mobile" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(current => (current ? { ...current, [key]: value } : current));

  async function upload(file: File, target: "desktop" | "mobile") {
    setUploading(target);
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
      update(target === "mobile" ? "mobileImagePath" : "imagePath", data.path);
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setUploading(null);
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
              mobileImagePath: row.mobile_image_path ?? "",
              focusDesktop: row.focus_desktop ?? "center",
              focusMobile: row.focus_mobile ?? "center",
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

  const previewImage = draft
    ? preview === "mobile"
      ? draft.mobileImagePath || draft.imagePath
      : draft.imagePath
    : "";
  const previewFocus = draft
    ? preview === "mobile"
      ? draft.focusMobile
      : draft.focusDesktop
    : "center";

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

      {!responsive && (
        <p className="m-0 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
          Mobile images and focal points need migration{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">0010_homepage_banner_responsive.sql</code>.
          Banners still save and display with a single image until it is applied.
        </p>
      )}

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

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-medium text-foreground">Desktop image *</span>
                <div className="relative grid aspect-[16/9] place-items-center overflow-hidden rounded-md border border-border bg-muted">
                  {draft.imagePath ? (
                    <Image
                      src={draft.imagePath}
                      alt="Desktop banner preview"
                      fill
                      sizes="(max-width: 1024px) 50vw, 260px"
                      className="object-cover"
                      style={{ objectPosition: draft.focusDesktop }}
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                      <ImagePlus size={18} aria-hidden="true" /> No image
                    </span>
                  )}
                </div>
                <label className="inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent">
                  <Upload size={13} aria-hidden="true" />
                  {uploading === "desktop" ? "Uploading…" : draft.imagePath ? "Replace image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    disabled={uploading !== null}
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file) void upload(file, "desktop");
                      event.target.value = "";
                    }}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                  Desktop focal point
                  <select
                    value={draft.focusDesktop}
                    onChange={e => update("focusDesktop", e.target.value as FocusOption)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-[12px] font-normal text-foreground"
                  >
                    {FOCUS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-[12px] font-medium text-foreground">Mobile image</span>
                <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-md border border-border bg-muted">
                  {draft.mobileImagePath || draft.imagePath ? (
                    <Image
                      src={draft.mobileImagePath || draft.imagePath}
                      alt="Mobile banner preview"
                      fill
                      sizes="160px"
                      className="object-cover"
                      style={{ objectPosition: draft.focusMobile }}
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                      <ImagePlus size={18} aria-hidden="true" /> No image
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent">
                    <Upload size={13} aria-hidden="true" />
                    {uploading === "mobile" ? "Uploading…" : draft.mobileImagePath ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      disabled={uploading !== null || !responsive}
                      onChange={event => {
                        const file = event.target.files?.[0];
                        if (file) void upload(file, "mobile");
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {draft.mobileImagePath && (
                    <button
                      type="button"
                      onClick={() => update("mobileImagePath", "")}
                      className="h-8 rounded-md border border-border px-3 text-[12px] font-medium text-foreground hover:bg-accent"
                    >
                      Use desktop image
                    </button>
                  )}
                </div>
                <label className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
                  Mobile focal point
                  <select
                    value={draft.focusMobile}
                    onChange={e => update("focusMobile", e.target.value as FocusOption)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-[12px] font-normal text-foreground"
                  >
                    {FOCUS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-foreground">Live preview</span>
                <div className="flex rounded-md border border-border p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreview("desktop")}
                    aria-pressed={preview === "desktop"}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
                      preview === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Monitor size={12} /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview("mobile")}
                    aria-pressed={preview === "mobile"}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
                      preview === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Smartphone size={12} /> Mobile
                  </button>
                </div>
              </div>

              <div
                className={`relative overflow-hidden rounded-lg border border-border bg-[#100024] ${
                  preview === "desktop" ? "aspect-[16/9]" : "mx-auto aspect-[4/5] w-[210px]"
                }`}
              >
                {previewImage ? (
                  <Image
                    src={previewImage}
                    alt=""
                    fill
                    sizes={preview === "desktop" ? "320px" : "210px"}
                    className="object-cover"
                    style={{ objectPosition: previewFocus }}
                  />
                ) : (
                  <div className="grid h-full place-items-center text-[11px] text-white/60">
                    Add an image to preview
                  </div>
                )}
                <div
                  className={
                    preview === "desktop"
                      ? "absolute inset-y-0 left-0 flex w-[54%] flex-col justify-center gap-1.5 p-4 text-white"
                      : "absolute inset-x-0 top-[26%] flex flex-col gap-1.5 p-4 text-white"
                  }
                >
                  <span className="text-[8px] font-bold uppercase tracking-wide text-white/80">
                    {draft.kicker || "KICKER"}
                  </span>
                  <strong className={`font-bold leading-tight ${preview === "desktop" ? "text-[19px]" : "text-[15px]"}`}>
                    {draft.title || "Banner title"}
                  </strong>
                  <span className="line-clamp-2 text-[9px] text-white/85">
                    {draft.subtitle || "Short supporting line"}
                  </span>
                  <span className="w-fit rounded-full bg-white px-2.5 py-1 text-[8px] font-bold text-[#100024]">
                    {draft.ctaLabel || "Shop now"}
                  </span>
                </div>
              </div>
              <p className="m-0 text-[11px] text-muted-foreground">
                Check that the title stays readable and the button is not hidden by the crop.
                {preview === "mobile" && !draft.mobileImagePath && " This mobile preview reuses the desktop image with the mobile focal point."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy || uploading !== null || !draft.title || !draft.imagePath}
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
                  <Image
                    src={banner.image_path}
                    alt=""
                    fill
                    sizes="132px"
                    className="object-cover"
                    style={{ objectPosition: banner.focus_desktop ?? "center" }}
                  />
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
                    {banner.mobile_image_path ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        <Smartphone size={10} /> Mobile image
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        <Monitor size={10} /> Desktop image only
                      </span>
                    )}
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
