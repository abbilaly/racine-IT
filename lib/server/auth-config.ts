import type { AdminSession } from "@/lib/server/admin-auth";
import type { AdminClient } from "@/lib/server/admin-client";

export async function getAdminRole(db: AdminClient, userId: string) {
  const { data, error } = await db
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.role ?? null;
}

export async function getAdminSessionStatus(db: AdminClient, session: AdminSession) {
  const role = await getAdminRole(db, session.userId);
  return { ...session, role };
}
