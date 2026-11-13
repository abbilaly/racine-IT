import { NextResponse } from "next/server";
import { getCustomerSession, customerClient, getCustomerProfile } from "@/lib/server/customer-auth";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ customer: null }, { status: 200 });
  }

  const db = customerClient(session);
  const profile = await getCustomerProfile(session, db);

  return NextResponse.json({
    customer: profile ? {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      phone: profile.phone ?? null,
      createdAt: profile.createdAt,
      emailConfirmed: profile.emailConfirmed
    } : null
  }, { status: 200 });
}
