import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const KINDS = new Set(["primary", "hover"]);

type Context = { params: Promise<{ id: string }> };

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireSession() {
  const session = await getAdminApiSession();
  return session;
}

/**
 * Upload (or replace) a product image slot.
 *
 * `product_images` allows one row per (product, kind), so a second upload for
 * the same slot replaces the previous file instead of failing the way the
 * earlier client code did when it called a route that did not exist.
 */
export async function POST(request: Request, context: Context) {
  const session = await requireSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const { id } = await context.params;
  if (!id) return fail("Product id is required.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Upload the image as multipart form data.");
  }

  const file = form.get("file");
  const kindValue = String(form.get("kind") ?? "primary");
  if (!KINDS.has(kindValue)) return fail("Image kind must be primary or hover.");
  const kind = kindValue as "primary" | "hover";

  if (!(file instanceof File)) return fail("No image file was provided.");
  if (!ALLOWED_TYPES.has(file.type)) {
    return fail("Images must be JPEG, PNG, WebP, GIF or AVIF.");
  }
  if (file.size > MAX_BYTES) return fail("Images must be 3 MB or smaller.");

  const db = adminClient(session);

  const { data: product, error: productError } = await db
    .from("products")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (productError) return fail(productError.message, 500);
  if (!product) return fail("That product no longer exists.", 404);

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const objectPath = `products/${id}/${kind}-${Date.now()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from("product-images")
    .upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (uploadError) return fail(`Upload failed: ${uploadError.message}`, 500);

  const { data: publicUrl } = db.storage.from("product-images").getPublicUrl(objectPath);

  /*
   * Replace rather than upsert with `onConflict`. The deployed database enforces
   * one image per slot with its own constraint names (for example
   * `product_images_primary_uq`), so naming `(product_id, kind)` in an upsert
   * fails with "no unique or exclusion constraint matching the ON CONFLICT
   * specification". Updating the existing row when there is one, and inserting
   * otherwise, works against both the repository migration and the live schema.
   */
  const { data: existing, error: readError } = await db
    .from("product_images")
    .select("id")
    .eq("product_id", id)
    .eq("kind", kind)
    .maybeSingle();
  if (readError) return fail(readError.message, 500);

  const row = {
    product_id: id,
    kind,
    path: publicUrl.publicUrl,
    position: kind === "primary" ? 0 : 1
  };

  const { error: writeError } = existing
    ? await db.from("product_images").update({ path: row.path }).eq("id", existing.id)
    : await db.from("product_images").insert(row);
  if (writeError) return fail(writeError.message, 500);

  return NextResponse.json(
    { path: publicUrl.publicUrl, kind, objectPath },
    { status: 201 }
  );
}

/** Remove an image slot (the stored object is left in the bucket). */
export async function DELETE(request: Request, context: Context) {
  const session = await requireSession();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const { id } = await context.params;
  if (!id) return fail("Product id is required.");

  const kind = new URL(request.url).searchParams.get("kind") ?? "primary";
  if (!KINDS.has(kind)) return fail("Image kind must be primary or hover.");

  const db = adminClient(session);
  const { error } = await db.from("product_images").delete().eq("product_id", id).eq("kind", kind);
  if (error) return fail(error.message, 500);

  return NextResponse.json({ ok: true });
}
