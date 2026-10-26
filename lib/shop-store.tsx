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
import {
  DEFAULT_SETTINGS,
  seedCatalog,
  type Catalog,
  type CategoryOption,
  type Product,
  type StoreSettings
} from "./products";

export const MAX_COMPARE = 4;
const STORAGE_KEY = "racine-shop-v1";

export type CartLine = { slug: string; qty: number };

type ShopState = {
  hydrated: boolean;
  cart: CartLine[];
  wishlist: string[];
  compare: string[];
  cartCount: number;
  cartTotal: number;
  /** Products from the database (or the seed catalogue when Supabase is off). */
  products: Product[];
  categories: CategoryOption[];
  settings: StoreSettings;
  getProduct: (slug: string) => Product | undefined;
  categoryLabel: (key: string) => string;
  searchProducts: (query: string) => Product[];
  addToCart: (slug: string, qty?: number) => void;
  setQty: (slug: string, qty: number) => void;
  removeFromCart: (slug: string) => void;
  clearCart: () => void;
  toggleWishlist: (slug: string) => void;
  toggleCompare: (slug: string) => void;
  clearCompare: () => void;
  inWishlist: (slug: string) => boolean;
  inCompare: (slug: string) => boolean;
};

const ShopContext = createContext<ShopState | null>(null);

type Persisted = { cart: CartLine[]; wishlist: string[]; compare: string[] };

const EMPTY: Persisted = { cart: [], wishlist: [], compare: [] };

function readStored(): Persisted {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      cart: Array.isArray(parsed.cart) ? parsed.cart : [],
      wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
      compare: Array.isArray(parsed.compare) ? parsed.compare : []
    };
  } catch {
    return EMPTY;
  }
}

export function ShopProvider({
  catalog,
  children
}: {
  catalog?: Catalog;
  children: ReactNode;
}) {
  const [state, setState] = useState<Persisted>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readStored());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable – state still works in memory */
    }
  }, [state, hydrated]);

  const addToCart = useCallback((slug: string, qty = 1) => {
    setState(prev => {
      const line = prev.cart.find(l => l.slug === slug);
      const cart = line
        ? prev.cart.map(l => (l.slug === slug ? { ...l, qty: l.qty + qty } : l))
        : [...prev.cart, { slug, qty }];
      return { ...prev, cart };
    });
  }, []);

  const setQty = useCallback((slug: string, qty: number) => {
    setState(prev => ({
      ...prev,
      cart:
        qty <= 0
          ? prev.cart.filter(l => l.slug !== slug)
          : prev.cart.map(l => (l.slug === slug ? { ...l, qty } : l))
    }));
  }, []);

  const removeFromCart = useCallback((slug: string) => {
    setState(prev => ({ ...prev, cart: prev.cart.filter(l => l.slug !== slug) }));
  }, []);

  const clearCart = useCallback(() => setState(prev => ({ ...prev, cart: [] })), []);

  const toggleWishlist = useCallback((slug: string) => {
    setState(prev => ({
      ...prev,
      wishlist: prev.wishlist.includes(slug)
        ? prev.wishlist.filter(s => s !== slug)
        : [...prev.wishlist, slug]
    }));
  }, []);

  const toggleCompare = useCallback((slug: string) => {
    setState(prev => {
      if (prev.compare.includes(slug)) return { ...prev, compare: prev.compare.filter(s => s !== slug) };
      if (prev.compare.length >= MAX_COMPARE) return prev;
      return { ...prev, compare: [...prev.compare, slug] };
    });
  }, []);

  const clearCompare = useCallback(() => setState(prev => ({ ...prev, compare: [] })), []);

  const activeCatalog = useMemo(() => catalog ?? seedCatalog(), [catalog]);

  const catalogueLookups = useMemo(() => {
    const bySlug = new Map(activeCatalog.products.map(p => [p.slug, p]));
    const labelByKey = new Map(activeCatalog.categories.map(c => [c.key, c.label]));
    return {
      bySlug,
      labelByKey,
      search: (query: string) => {
        const q = query.trim().toLowerCase();
        if (!q) return activeCatalog.products;
        const terms = q.split(/\s+/);
        return activeCatalog.products.filter(p => {
          const haystack = `${p.title} ${p.category} ${p.short} ${labelByKey.get(p.category) ?? ""}`.toLowerCase();
          return terms.every(t => haystack.includes(t));
        });
      }
    };
  }, [activeCatalog]);

  const value = useMemo<ShopState>(() => {
    const getProduct = (slug: string) => catalogueLookups.bySlug.get(slug);
    const cartCount = state.cart.reduce((n, l) => n + l.qty, 0);
    const cartTotal = state.cart.reduce((sum, l) => {
      const product = getProduct(l.slug);
      return product ? sum + product.price * l.qty : sum;
    }, 0);
    return {
      hydrated,
      ...state,
      cartCount,
      cartTotal,
      products: activeCatalog.products,
      categories: activeCatalog.categories,
      settings: activeCatalog.settings ?? DEFAULT_SETTINGS,
      getProduct,
      categoryLabel: key => catalogueLookups.labelByKey.get(key) ?? "All Products",
      searchProducts: catalogueLookups.search,
      addToCart,
      setQty,
      removeFromCart,
      clearCart,
      toggleWishlist,
      toggleCompare,
      clearCompare,
      inWishlist: slug => state.wishlist.includes(slug),
      inCompare: slug => state.compare.includes(slug)
    };
  }, [
    state,
    hydrated,
    activeCatalog,
    catalogueLookups,
    addToCart,
    setQty,
    removeFromCart,
    clearCart,
    toggleWishlist,
    toggleCompare,
    clearCompare
  ]);

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopState {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop must be used inside <ShopProvider>");
  return ctx;
}
