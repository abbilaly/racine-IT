import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";

/**
 * Category banners and brand logos.
 *
 * Reuses the approved Supabase Storage bucket already used for product images
 * (`product-images`) and the administrator's own session, so storage RLS stays
 * the boundary exactly as it does for product uploads. Paths are namespaced by
 * kind so catalogue assets stay separate from product photography.
 */

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const FOLDERS = {
  "category-banner": "categories",
  "brand-logo": "brands"
} as const;

type UploadKind = keyof typeof FOLDERS;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const kindParam = new URL(request.url).searchParams.get("kind") ?? "";
  if (!(kindParam in FOLDERS)) {
    return fail("Upload kind must be category-banner or brand-logo.", 400);
  }
  const kind = kindParam as UploadKind;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Upload the image as multipart form data.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return fail("No image file was provided.", 400);
  if (!ALLOWED_TYPES.has(file.type)) {
    return fail("Images must be JPEG, PNG, WebP or AVIF.", 400);
  }
  if (file.size === 0) return fail("The image file is empty.", 400);
  if (file.size > MAX_BYTES) return fail("Images must be 3 MB or smaller.", 400);

  // Verify the bytes really are an image rather than trusting the MIME header.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = bytes.subarray(0, 12);
  const isJpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const isPng =
    signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4e && signature[3] === 0x47;
  const isWebp =
    String.fromCharCode(...signature.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...signature.subarray(8, 12)) === "WEBP";
  const isAvif = String.fromCharCode(...signature.subarray(4, 12)).includes("ftypavif");
  if (!isJpeg && !isPng && !isWebp && !isAvif) {
    return fail("That file is not a valid image.", 400);
  }

  const extension =
    file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    (isPng ? "png" : isWebp ? "webp" : isAvif ? "avif" : "jpg");
  const objectPath = `${FOLDERS[kind]}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;

  const db = adminClient(session);
  const { error } = await db.storage
    .from("product-images")
    .upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (error) return fail(`Upload failed: ${error.message}`, 500);

  const { data } = db.storage.from("product-images").getPublicUrl(objectPath);
  return NextResponse.json({ path: data.publicUrl, objectPath }, { status: 201 });
}
