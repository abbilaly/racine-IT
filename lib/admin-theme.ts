export type AdminTheme = "light" | "dark" | "system";
export type ResolvedAdminTheme = "light" | "dark";

/**
 * Cookie the admin theme preference is persisted in. Shared constant so the
 * server reader and the client provider cannot drift apart.
 */
export const ADMIN_THEME_COOKIE = "ab-admin-theme";

export function isAdminTheme(value: string | undefined | null): value is AdminTheme {
  return value === "light" || value === "dark" || value === "system";
}
