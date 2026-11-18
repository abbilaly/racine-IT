import { cookies } from "next/headers";
import { ADMIN_THEME_COOKIE, isAdminTheme, type AdminTheme } from "@/lib/admin-theme";

/**
 * Theme stored in the request cookies; `system` when nothing (valid) is set.
 *
 * Reading this on the server lets the admin layout render the correct
 * `data-admin-theme` in the first HTML response, which is what removes the
 * light-mode flash and the mis-coloured labels after a refresh.
 */
export async function getAdminTheme(): Promise<AdminTheme> {
  const store = await cookies();
  const value = store.get(ADMIN_THEME_COOKIE)?.value;
  return isAdminTheme(value) ? value : "system";
}
