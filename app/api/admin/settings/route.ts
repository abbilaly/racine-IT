import { NextResponse } from "next/server";
import { adminClient, getAdminApiSession } from "@/lib/server/admin-auth";

export async function PATCH(request: Request) {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  }

  let body: {
    storeName?: unknown;
    standardShipping?: unknown;
    expressShipping?: unknown;
    checkoutEnabled?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "The request body must be JSON." }, { status: 400 });
  }

  const storeName =
    typeof body.storeName === "string" ? body.storeName.trim() : "";
  if (storeName.length < 1 || storeName.length > 60) {
    return NextResponse.json({ error: "Store name is required." }, { status: 400 });
  }

  const toCents = (value: unknown, field: string): number | null => {
    if (value == null || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 10000) {
      throw new Error(`${field} must be a positive amount.`);
    }
    return Math.round(numeric * 100);
  };

  let standard: number;
  let express: number;
  try {
    const standardRaw = toCents(body.standardShipping, "Standard shipping");
    const expressRaw = toCents(body.expressShipping, "Express shipping");
    if (standardRaw == null || expressRaw == null) {
      return NextResponse.json({ error: "Shipping fees are required." }, { status: 400 });
    }
    standard = standardRaw;
    express = expressRaw;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid settings." },
      { status: 400 }
    );
  }

  const db = adminClient(session);
  const { data, error } = await db
    .from("store_settings")
    .update({
      store_name: storeName,
      standard_shipping_cents: standard,
      express_shipping_cents: express,
      checkout_enabled: body.checkoutEnabled !== false
    })
    .eq("id", true)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Settings row is missing." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
