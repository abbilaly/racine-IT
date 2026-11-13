import { productImageUrl } from "@/lib/server/image-url";

export function productImageUrlForPath(path: string | null | undefined): string | null {
  return productImageUrl(path);
}
