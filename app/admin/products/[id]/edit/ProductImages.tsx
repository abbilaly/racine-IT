"use client";

import Image from "next/image";
import { Upload, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface ProductImagesProps {
  productId: string;
  images: Array<{
    id: string;
    path: string;
    kind: string;
    is_primary: boolean;
  }>;
}

export function ProductImages({ productId, images }: ProductImagesProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/products/${productId}/images`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to upload image.");
        return;
      }
      const data = await res.json();
      router.refresh();
    } catch {
      alert("Network error while uploading image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-product-images">
      {images.length === 0 ? (
        <div className="admin-empty">
          <p className="admin-empty-text">No images uploaded yet.</p>
          <label className="admin-upload-btn">
            <Upload size={16} />
            Upload image
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              className="admin-upload-input"
            />
          </label>
        </div>
      ) : (
        <div className="admin-image-grid">
          {images.map((image, index) => (
            <div key={image.id} className={`admin-image-item${image.is_primary ? " admin-image-item--primary" : ""}`}>
              <div className="admin-image-wrap">
                <Image
                  src={image.path}
                  alt={`Product image ${index + 1}`}
                  width={120}
                  height={120}
                  className="admin-image"
                  style={{ objectFit: "cover" }}
                />
                {image.is_primary && (
                  <div className="admin-image-badge">
                    <Check size={12} />
                  </div>
                )}
                <button
                  className="admin-image-remove"
                  onClick={async () => {
                    if (!window.confirm("Remove this image?")) return;
                    const res = await fetch(`/api/admin/products/${productId}/images/${image.id}`, {
                      method: "DELETE",
                    });
                    if (res.ok) {
                      router.refresh();
                    } else {
                      alert("Failed to remove image.");
                    }
                  }}
                  aria-label="Remove image"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="admin-image-label">{image.kind === "primary" ? "Primary" : `Image ${index + 1}`}</p>
            </div>
          ))}
        </div>
      )}

      <label className="admin-upload-btn admin-upload-btn--secondary">
        {uploading ? "Uploading…" : <><Upload size={16} /> Upload more</>}
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          disabled={uploading}
          className="admin-upload-input"
        />
      </label>
    </div>
  );
}
