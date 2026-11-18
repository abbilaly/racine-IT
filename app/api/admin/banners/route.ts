import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";
import {
  createBanner,
  deleteBanner,
  listBanners,
  normaliseBannerInput,
  updateBanner
} from "@/lib/server/banners";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function sessionOrNull() {
  return getAdminApiSession();
}

export async function GET() {
  const session = await sessionOrNull();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const db = adminClient(session);
  try {
    const result = await listBanners(db);
    return NextResponse.json(result);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not load banners.", 500);
  }
}

export async function POST(request: Request) {
  const session = await sessionOrNull();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("The request body must be JSON.");
  }

  let input;
  try {
    input = normaliseBannerInput(body);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid banner.");
  }

  const db = adminClient(session);
  try {
    const row = await createBanner(db, input);
    return NextResponse.json(row, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not create the banner.", 500);
  }
}

export async function PATCH(request: Request) {
  const session = await sessionOrNull();
  if (!session) return fail("Administrator sign-in is required.", 401);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("The request body must be JSON.");
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return fail("Banner id is required.");

  let input;
  try {
    input = normaliseBannerInput(body);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Invalid banner.");
  }

  const db = adminClient(session);
  try {
    const row = await updateBanner(db, id, input);
    if (!row) return fail("That banner no longer exists.", 404);
    return NextResponse.json(row);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not save the banner.", 500);
  }
}

export async function DELETE(request: Request) {
  const session = await sessionOrNull();
  if (!session) return fail("Administrator sign-in is required.", 401);

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return fail("Banner id is required.");

  const db = adminClient(session);
  try {
    await deleteBanner(db, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Could not delete the banner.", 500);
  }
}
