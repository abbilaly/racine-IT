"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { AdminTheme, ResolvedAdminTheme } from "@/lib/admin-theme";
import { ADMIN_THEME_COOKIE } from "@/lib/admin-theme";

/**
 * Admin theme state.
 *
 * Scoped deliberately: the theme is written as `data-admin-theme` on the admin
 * shell wrapper, never as a class on `<html>`. The storefront shares the root
 * document, so a global theme class from next-themes (or any `document.documentElement`
 * mutation) would leak admin styling into the shop.
 *
 * Initialisation: the layout reads the persisted preference from a cookie and
 * passes it in as `initialTheme`, so the server-rendered markup already carries
 * the correct `data-admin-theme`. That removes the light flash after a refresh
 * and the hydration mismatch that came from resolving the theme in an effect.
 * `system` is the only case that still needs the client to know the OS setting;
 * that is applied right after mount, before interactive content paints.
 */

type ThemeContextValue = {
  theme: AdminTheme;
  resolved: ResolvedAdminTheme;
  setTheme: (theme: AdminTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolved: "light",
  setTheme: () => undefined
});

const STORAGE_KEY = "ab-admin-theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

function prefersDark(): ResolvedAdminTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function persist(theme: AdminTheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Preference is optional.
  }
  try {
    // `system` clears the override so the next request falls back to the OS.
    document.cookie = `${ADMIN_THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  } catch {
    // Cookies can be blocked; the current session still keeps the choice.
  }
}

export function AdminThemeProvider({
  children,
  initialTheme = "system",
  className = "admin-shell admin-layout"
}: {
  children: ReactNode;
  initialTheme?: AdminTheme;
  className?: string;
}) {
  const [theme, setThemeState] = useState<AdminTheme>(initialTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedAdminTheme>("light");
  const applied = useRef(false);

  useEffect(() => {
    // Migrate a preference saved by an older build that only used localStorage.
    if (!applied.current) {
      applied.current = true;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (
          initialTheme === "system" &&
          (stored === "light" || stored === "dark" || stored === "system")
        ) {
          setThemeState(stored);
          persist(stored);
        }
      } catch {
        // Storage can be blocked; the cookie value still applies.
      }
    }

    setSystemTheme(prefersDark());
    if (!window.matchMedia) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [initialTheme]);

  const setTheme = useCallback((next: AdminTheme) => {
    setThemeState(next);
    persist(next);
  }, []);

  const resolved: ResolvedAdminTheme = theme === "system" ? systemTheme : theme;
  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={className}
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
