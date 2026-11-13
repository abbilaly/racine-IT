import { NextResponse } from "next/server";
import { getAdminApiSession, getAdminClient } from "@/lib/server/admin-auth";
import { getProductBySlug, getProductById } from "@/lib/server/product";

export async function GET(request: Request) {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const id = searchParams.get("id");

  if (!slug) {
    return NextResponse.json({ error: "Slug is required" }, { status: 400 });
  }

  const normalizedSlug = slug.trim().toLowerCase().replace(/\s+/g, "-");

  try {
    const db = getAdminClient(session);
    const existing = await getProductBySlug(db, normalizedSlug);
    if (!existing) {
      return NextResponse.json({ taken: false });
    }

    if (id) {
      const current = await getProductById(db, id);
      // the slug belongs to the product being edited → still available
      if (current && current.id === existing.id) {
        return NextResponse.json({ taken: false });
      }
    }

    return NextResponse.json({ taken: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to check slug" }, { status: 500 });
  }
}
