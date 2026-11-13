import { NextResponse } from "next/server";
import { getAdminApiSession } from "@/lib/server/admin-auth";
import { getWebhookDiagnostics } from "@/lib/server/email-center";

export async function GET() {
  const session = await getAdminApiSession();
  if (!session) {
    return NextResponse.json(
      { error: "Administrator sign-in is required." },
      { status: 401 }
    );
  }

  // Only booleans and non-secret configuration names are returned. Secret
  // values never leave the Worker.
  return NextResponse.json(getWebhookDiagnostics());
}

export const dynamic = "force-dynamic";
