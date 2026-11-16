"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

/**
 * Admin theme state.
 *
 * Scoped deliberately: the theme is written as `data-admin-theme` on the admin
 * shell wrapper, never as a class on `<html>`. The storefront shares the root
 * document, so a global theme class from next-themes (or any `document.documentElement`
 * mutation) would leak admin styling into the shop.
 */

export type AdminTheme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "ab-admin-theme";

type ThemeContextValue = {
  theme: AdminTheme;
  resolved: ResolvedTheme;
  setTheme: (theme: AdminTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolved: "light",
  setTheme: () => undefined
});

function prefersDark(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AdminThemeProvider({
  children,
  defaultTheme = "system"
}: {
  children: ReactNode;
  defaultTheme?: AdminTheme;
}) {
  const [theme, setThemeState] = useState<AdminTheme>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        setThemeState(stored);
      }
    } catch {
      // Storage can be blocked; the default theme still applies.
    }

    setSystemTheme(prefersDark());
    if (!window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((next: AdminTheme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting the preference is best-effort.
    }
  }, []);

  const resolved: ResolvedTheme = theme === "system" ? systemTheme : theme;
  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <div
        className="admin-shell admin-layout"
        data-admin-theme={resolved}
        suppressHydrationWarning
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useAdminTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
