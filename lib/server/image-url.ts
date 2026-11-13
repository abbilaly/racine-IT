export function productImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `https://storage.googleapis.com/ab-tech-store/product-images/${encodeURIComponent(path)}`;
}
