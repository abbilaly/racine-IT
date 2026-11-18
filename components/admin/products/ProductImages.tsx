"use client";

import Image from "next/image";
import { Upload, Trash2, Check, ImageOff } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ImageRow = {
  id: string;
  path: string;
  kind: string;
  is_primary: boolean;
};

const SLOTS: Array<{ kind: "primary" | "hover"; label: string; hint: string }> = [
  { kind: "primary", label: "Primary image", hint: "Shown on product cards and at the top of the product page." },
  { kind: "hover", label: "Hover image", hint: "Optional second image shown when a card is hovered." }
];

/**
 * Product image manager.
 *
 * `product_images` stores one row per (product, kind), so the UI exposes the two
 * supported slots rather than an arbitrary gallery. Uploading into an occupied
 * slot replaces it, which is what the owner asked for: upload, replace, remove.
 */
export function ProductImages({ productId, images }: { productId: string; images: ImageRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byKind = new Map(images.map(image => [image.kind, image]));

  async function upload(kind: "primary" | "hover", file: File) {
    setBusy(kind);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("kind", kind);
      const res = await fetch(`/api/admin/products/${productId}/images`, { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "The image could not be uploaded.");
        return;
      }
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: "primary" | "hover") {
    if (!window.confirm("Remove this image? The product will fall back to the other image or a placeholder.")) {
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/images?kind=${kind}`, {
        method: "DELETE"
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "The image could not be removed.");
        return;
      }
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {SLOTS.map(slot => {
          const image = byKind.get(slot.kind);
          return (
            <div key={slot.kind} className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-foreground">{slot.label}</span>
                {slot.kind === "primary" && image && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <Check size={11} aria-hidden="true" /> Live
                  </span>
                )}
              </div>

              <div className="relative mb-3 grid aspect-[4/3] place-items-center overflow-hidden rounded-md border border-border bg-muted">
                {image ? (
                  <Image
                    src={image.path}
                    alt={`${slot.label} preview`}
                    fill
                    sizes="(max-width: 640px) 100vw, 320px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageOff size={20} aria-hidden="true" />
                    <span className="text-[11px]">No image</span>
                  </span>
                )}
              </div>

              <p className="m-0 mb-3 text-[11px] leading-relaxed text-muted-foreground">{slot.hint}</p>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 aria-disabled:opacity-60">
                  <Upload size={13} aria-hidden="true" />
                  {busy === slot.kind ? "Uploading…" : image ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="sr-only"
                    disabled={busy !== null}
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file) void upload(slot.kind, file);
                      event.target.value = "";
                    }}
                  />
                </label>

                {image && (
                  <button
                    type="button"
                    onClick={() => void remove(slot.kind)}
                    disabled={busy !== null}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                  >
                    <Trash2 size={13} aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
          {error}
        </p>
      )}

      <p className="m-0 text-[11px] text-muted-foreground">
        JPEG, PNG, WebP, GIF or AVIF, up to 3 MB. Images are stored in the shared product-images bucket.
      </p>
    </div>
  );
}
