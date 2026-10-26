import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export async function POST(request: Request) {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Upload the image as multipart form data." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file was provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Images must be JPEG, PNG, WebP, GIF or AVIF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Images must be 3 MB or smaller." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
  const objectPath = `products/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const db = adminClient(session);
  const { error } = await db.storage
    .from("product-images")
    .upload(objectPath, bytes, { contentType: file.type, upsert: false });
  if (error) {
    return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
  }

  const { data } = db.storage.from("product-images").getPublicUrl(objectPath);
  return NextResponse.json({ path: data.publicUrl, objectPath }, { status: 201 });
}
