import { DEFAULT_CURRENCY, formatMoney } from "@/lib/currency";

export const ASSET = "/images";
export const PAYMENTS = "/images/payment.webp";

export type Product = {
  slug: string;
  title: string;
  category: string;
  /** Brand name, when the catalogue knows it (products.brand_id → brands.name). */
  brand?: string;
  /** Available colourways, when the catalogue knows them. */
  colours?: string[];
  /** Country of origin, when the catalogue records it (products.origin). */
  origin?: string;
  image: string;
  hover: string;
  price: number;
  oldPrice?: number;
  badge?: string;
  rating: number;
  reviews: number;
  stock: number;
  short: string;
  description: string[];
  specs: [string, string][];
  /** ISO timestamp from products.created_at, when the catalogue exposes it. */
  createdAt?: string;
  /** products.is_featured: the owner's own featured selection. */
  featured?: boolean;
};

export type CategoryOption = { key: string; label: string };

/** Shipping and checkout settings, sourced from public.store_settings when Supabase is connected. */
export type StoreSettings = {
  storeName: string;
  /** ISO currency code the stored prices are denominated in. Display only:
   *  amounts are never converted. */
  currency: string;
  /** Express delivery fee in the store currency. */
  expressShipping: number;
  /** Standard delivery fee in the store currency. */
  standardShipping: number;
  checkoutEnabled: boolean;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "AB Tech",
  currency: "USD",
  expressShipping: 15,
  standardShipping: 0,
  checkoutEnabled: true
};

/** Everything the storefront renders from: products, categories and store settings. */
export type Catalog = {
  products: Product[];
  categories: CategoryOption[];
  settings: StoreSettings;
};

/** The approved 14 main categories, in the exact order and with the exact
 *  labels stored in public.categories (positions 1..14). This list feeds the
 *  offline demo catalogue and supabase/seed.sql, so it must stay in step with
 *  the database taxonomy applied by migration 0007. */
export const CATEGORIES = [
  { key: "computers", label: "Computers & Laptops" },
  { key: "desktops", label: "Desktop Computers" },
  { key: "servers", label: "Servers" },
  { key: "networking", label: "Networking & Telecom" },
  { key: "components", label: "PC Components" },
  { key: "smartphones", label: "Smartphones & Tablets" },
  { key: "wearables", label: "Wearables & Smartwatches" },
  { key: "gaming", label: "Gaming" },
  { key: "printers", label: "Printers & Scanners" },
  { key: "monitors", label: "Monitors & Displays" },
  { key: "multimedia", label: "Multimedia & Audio" },
  { key: "peripherals", label: "Peripherals & Accessories" },
  { key: "software", label: "Software & Licenses" },
  { key: "power", label: "UPS & Power" }
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

/** The same list in the shape the catalogue layer uses. */
export const SEED_CATEGORIES: CategoryOption[] = CATEGORIES.map(c => ({
  key: c.key,
  label: c.label
}));

/** Real AB Tech subcategory hierarchy for the Gloxin-style category panel.
 *  Only categories with children get a submenu on hover/click; leaf categories
 *  navigate straight to the filtered shop route.
 */
export const CATEGORY_SUBKEYS: Record<string, string[]> = {
  computers: ["desktops", "laptops", "monitors", "components", "servers", "peripherals"],
  desktops: ["all-in-one", "tower", "workstation"],
  servers: ["rack-servers", "tower-servers", "server-racks", "storage-nas"],
  networking: ["routers", "switches", "modems", "wi-fi-extenders", "network-cables"],
  components: ["cpus", "gpus", "memory", "storage", "motherboards", "power-supplies"],
  smartphones: [
    "iphone",
    "android",
    "feature-phones",
    "phone-accessories",
    "ipad-pro",
    "ipad-air",
    "android-tablets",
    "tablet-accessories",
  ],
  wearables: ["smartwatches", "fitness-bands", "watch-bands", "watch-accessories"],
  gaming: ["consoles", "games", "gaming-pcs", "peripherals"],
  printers: ["inkjet", "laser", "multifunction", "printer-supplies"],
  monitors: ["computer-monitors", "curved-monitors", "professional-monitors", "monitor-arms"],
  multimedia: ["headphones", "speakers", "home-audio", "audio-accessories"],
  peripherals: ["keyboards", "mice", "webcams", "hubs-docks", "cables", "mounts"],
  software: ["operating-systems", "productivity", "security", "creative", "b2b-licenses"],
  power: ["ups", "surge-protectors", "inverters", "battery-backups"],
};

export const products: Product[] = [
  {
    slug: "apple-iphone-13-mini-128gb-pink",
    title: "Apple iPhone 13 Mini 128GB Pink – Unlocked (Renewed)",
    category: "smartphones",
    image: "products_digital_1_1-min.webp",
    hover: "products_digital_1_2-min-400x400.webp",
    price: 175,
    oldPrice: 195,
    badge: "-10%",
    rating: 5,
    reviews: 42,
    stock: 18,
    short: "Compact 5.4-inch flagship in pink, factory unlocked and renewed to like-new condition.",
    description: [
      "The iPhone 13 Mini packs the full A15 Bionic experience into a pocket-friendly 5.4-inch body. This renewed unit is inspected, cleaned and tested by our technicians before it ships.",
      "Unlocked for any carrier, with 128GB of storage, a dual 12MP camera system and MagSafe support.",
    ],
    specs: [
      ["Display", "5.4-inch Super Retina XDR"],
      ["Chip", "A15 Bionic"],
      ["Storage", "128GB"],
      ["Camera", "12MP wide + 12MP ultra wide"],
      ["Condition", "Renewed – like new"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "apple-watch-aluminum-case-pride-edition",
    title: "Apple Watch Aluminum Case – Pride Edition New 2024",
    category: "wearables",
    image: "products_digital_2_1-min.webp",
    hover: "products_digital_2_2-min-400x400.webp",
    price: 175,
    oldPrice: 195,
    badge: "-10%",
    rating: 5,
    reviews: 27,
    stock: 11,
    short: "Pride Edition band with the aluminium case, always-on display and health sensors.",
    description: [
      "A celebration on your wrist: the Pride Edition sport band paired with the lightweight aluminium case.",
      "Tracks workouts, heart rate and sleep, with an always-on retina display that stays readable outdoors.",
    ],
    specs: [
      ["Case size", "44mm"],
      ["Material", "Aluminium"],
      ["Band", "Pride Edition sport band"],
      ["Sensors", "Heart rate, SpO2, always-on"],
      ["Connectivity", "GPS + Wi-Fi"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "apple-ipad-pro-m1-12-inch-2022",
    title: "Apple iPad Pro M1 12-inch 2022 Wi-Fi 128GB – Blue",
    category: "smartphones",
    image: "products_digital_3_1-min.webp",
    hover: "products_digital_3_2-min-400x400.webp",
    price: 175,
    oldPrice: 195,
    badge: "-10%",
    rating: 4,
    reviews: 19,
    stock: 7,
    short: "M1 power in a 12-inch liquid retina display, Wi-Fi only, 128GB.",
    description: [
      "Desktop-class performance in a thin aluminium slate. The M1 chip handles editing, drawing and multitasking without breaking a stride.",
      "This listing is the Wi-Fi only configuration with 128GB of storage in blue.",
    ],
    specs: [
      ["Display", "12.9-inch Liquid Retina XDR"],
      ["Chip", "Apple M1"],
      ["Storage", "128GB"],
      ["Connectivity", "Wi-Fi"],
      ["Colour", "Blue"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "valdus-round-smart-watch-blood-pressure",
    title: "Valdus Round Smart Watch Blood Pressure – Dark Blue",
    category: "wearables",
    image: "products_digital_4_1-min.webp",
    hover: "products_digital_4_2-min-400x400.webp",
    price: 150,
    oldPrice: 175,
    badge: "-14%",
    rating: 4,
    reviews: 63,
    stock: 24,
    short: "Round-face smartwatch with blood-pressure tracking and call notifications.",
    description: [
      "A classic round dial hiding modern sensors: blood pressure, heart rate, steps and sleep, all synced to your phone.",
      "Bluetooth calls and message alerts keep your phone in your pocket while you stay reachable.",
    ],
    specs: [
      ["Display", "1.32-inch round TFT"],
      ["Battery", "Up to 7 days"],
      ["Sensors", "Blood pressure, heart rate"],
      ["Features", "Bluetooth calls, notifications"],
      ["Colour", "Dark Blue"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "apple-ipad-pro-m1-11-inch-2021",
    title: "Apple iPad Pro M1 11-inch 2021 Wi-Fi 128GB – Black",
    category: "smartphones",
    image: "products_digital_5_1-min.webp",
    hover: "products_digital_5_2-min-400x400.webp",
    price: 150,
    oldPrice: 175,
    badge: "-14%",
    rating: 5,
    reviews: 31,
    stock: 9,
    short: "11-inch M1 iPad Pro, Wi-Fi, 128GB in black – the everyday workhorse.",
    description: [
      "The 11-inch iPad Pro strikes the balance between portability and screen real estate.",
      "M1 performance, ProMotion 120Hz display and a USB-C port ready for external drives and displays.",
    ],
    specs: [
      ["Display", "11-inch Liquid Retina, 120Hz"],
      ["Chip", "Apple M1"],
      ["Storage", "128GB"],
      ["Connectivity", "Wi-Fi"],
      ["Colour", "Black"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "proove-wireless-headset-gaming-bliss",
    title: "2024 Proove Wireless Headset Gaming Bliss – White",
    category: "multimedia",
    image: "products_digital_6_1-min.webp",
    hover: "products_digital_6_2-min-400x400.webp",
    price: 150,
    oldPrice: 175,
    badge: "-14%",
    rating: 4,
    reviews: 55,
    stock: 15,
    short: "Low-latency wireless gaming headset with memory-foam cushions and a boom mic.",
    description: [
      "Designed for long sessions: 2.4GHz low-latency wireless, plush memory-foam earcups and a detachable boom microphone.",
      "Cross-platform with PC, PlayStation and mobile, plus a 3.5mm fallback for controllers.",
    ],
    specs: [
      ["Connection", "2.4GHz wireless + 3.5mm"],
      ["Battery", "Up to 30 hours"],
      ["Microphone", "Detachable boom"],
      ["Driver", "50mm"],
      ["Colour", "White"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "macbook-pro-16-m3-gray-2025",
    title: "Hot Sales For Original MacBooks Pro 16 M3 Gray 2025",
    category: "computers",
    image: "products_digital_7_1-min.webp",
    hover: "products_digital_7_2-min-400x400.webp",
    price: 175,
    oldPrice: 195,
    badge: "-10%",
    rating: 5,
    reviews: 88,
    stock: 5,
    short: "16-inch MacBook Pro with the M3 chip in space gray – creator-grade performance.",
    description: [
      "The 16-inch chassis with room for a bigger battery and quieter cooling, now with the M3 chip.",
      "Ideal for video editing, 3D work and long compile times away from a power outlet.",
    ],
    specs: [
      ["Display", "16-inch Liquid Retina XDR"],
      ["Chip", "Apple M3"],
      ["Memory", "16GB unified"],
      ["Storage", "512GB SSD"],
      ["Colour", "Space Gray"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "apple-iphone-13-mini-128gb-blue",
    title: "Apple iPhone 13 Mini 128GB Blue – Unlocked (Renewed)",
    category: "smartphones",
    image: "products_digital_8_1-min.webp",
    hover: "products_digital_8_2-min-400x400.webp",
    price: 175,
    rating: 4,
    reviews: 23,
    stock: 21,
    short: "The blue colourway of the renewed 128GB iPhone 13 Mini, unlocked for any carrier.",
    description: [
      "Same compact flagship as the pink model, finished in blue.",
      "Renewed, tested and covered by a 12-month warranty.",
    ],
    specs: [
      ["Display", "5.4-inch Super Retina XDR"],
      ["Chip", "A15 Bionic"],
      ["Storage", "128GB"],
      ["Camera", "12MP wide + 12MP ultra wide"],
      ["Condition", "Renewed – like new"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "apple-airpods-3-2022",
    title: "Apple AirPods 3 2022 Bluetooth Headset – Unlocked",
    category: "multimedia",
    image: "products_digital_9_1-min.webp",
    hover: "products_digital_9_2-min-400x400.webp",
    price: 150,
    rating: 5,
    reviews: 74,
    stock: 32,
    short: "Spatial audio, adaptive EQ and a comfortable open fit with a MagSafe case.",
    description: [
      "AirPods (3rd generation) bring spatial audio and adaptive EQ to a contoured, open fit.",
      "Up to 6 hours of listening, with 30 hours total from the MagSafe charging case.",
    ],
    specs: [
      ["Chip", "Apple H1"],
      ["Battery", "6h listening / 30h with case"],
      ["Audio", "Spatial audio, adaptive EQ"],
      ["Case", "MagSafe charging"],
      ["Release", "2022"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "macbook-pro-16-m2-gray",
    title: "Hot Sales For Original MacBooks Pro 16 M2 – Gray Color",
    category: "computers",
    image: "products_digital_10_1-min.webp",
    hover: "products_digital_10_2-min-400x400.webp",
    price: 2399,
    oldPrice: 2499,
    badge: "-4%",
    rating: 5,
    reviews: 16,
    stock: 3,
    short: "The M2-generation 16-inch MacBook Pro, top configuration in gray.",
    description: [
      "A high-spec 16-inch MacBook Pro for professionals who need sustained performance.",
      "Configured for demanding timelines: large unified memory, fast SSD and an XDR display.",
    ],
    specs: [
      ["Display", "16-inch Liquid Retina XDR"],
      ["Chip", "Apple M2 Pro"],
      ["Memory", "32GB unified"],
      ["Storage", "1TB SSD"],
      ["Colour", "Space Gray"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "apple-iphone-13-mini-128gb-white",
    title: "Apple iPhone 13 Mini 128GB White – Unlocked (Renewed)",
    category: "smartphones",
    image: "products_digital_11_1-min.webp",
    hover: "products_digital_11_2-min-400x400.webp",
    price: 150,
    rating: 4,
    reviews: 18,
    stock: 26,
    short: "Starlight white renewed iPhone 13 Mini, unlocked and warrantied for 12 months.",
    description: [
      "The neutral starlight finish of the compact iPhone 13 Mini.",
      "Unlocked, renewed and tested, with 128GB of storage.",
    ],
    specs: [
      ["Display", "5.4-inch Super Retina XDR"],
      ["Chip", "A15 Bionic"],
      ["Storage", "128GB"],
      ["Camera", "12MP wide + 12MP ultra wide"],
      ["Condition", "Renewed – like new"],
      ["Warranty", "12 months"],
    ],
  },
  {
    slug: "portable-wireless-speakers-2025",
    title: "Portable Wireless Speakers Music Speakers New 2025",
    category: "multimedia",
    image: "products_digital_12_1-min_440c4ce0-1c9b-491b-ad23-41bd1de013fe.webp",
    hover: "products_digital_12_2-min_f6726fbb-a322-4e34-8bd1-65436e926f59-400x400.webp",
    price: 135,
    oldPrice: 148,
    badge: "-9%",
    rating: 4,
    reviews: 37,
    stock: 40,
    short: "Punchy portable Bluetooth speaker with deep bass and a 20-hour battery.",
    description: [
      "Big sound in a small shell: dual drivers and a passive radiator deliver bass you can feel.",
      "IPX5 splash resistance and 20 hours of playback make it a garden or beach speaker.",
    ],
    specs: [
      ["Connection", "Bluetooth 5.3"],
      ["Battery", "Up to 20 hours"],
      ["Rating", "IPX5 splash resistant"],
      ["Output", "20W dual driver"],
      ["Release", "2025"],
      ["Warranty", "12 months"],
    ],
  },
];

export const productMap: Record<string, Product> = Object.fromEntries(
  products.map(p => [p.slug, p])
);

/**
 * The offline catalogue baked into the app. It is used until Supabase is
 * configured (and as the seed for supabase/seed.sql).
 */
export function seedCatalog(): Catalog {
  return {
    products: products.map(p => ({ ...p })),
    categories: SEED_CATEGORIES.map(c => ({ ...c })),
    settings: { ...DEFAULT_SETTINGS }
  };
}

export function getProduct(slug: string): Product | undefined {
  return productMap[slug];
}

export function categoryLabel(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.label ?? "All Products";
}

export function categorySubkeys(key: string): readonly string[] {
  return CATEGORY_SUBKEYS[key] ?? [];
}

export function hasSubcategories(key: string): boolean {
  return (CATEGORY_SUBKEYS[key]?.length ?? 0) > 0;
}

/** Best shop route for a category or subcategory key. Subcategories that map
 *  directly onto a real product category keep their filtered route; everything
 *  else falls back to the parent catalogue filtered route or /shop.
 */
const ALL_CATEGORY_KEYS: readonly CategoryKey[] = CATEGORIES.map(c => c.key);

export function categoryShopHref(key: string): string {
  if (key === "") return "/shop";
  const parentKey = parentKeyFor(key);
  if (parentKey && ALL_CATEGORY_KEYS.includes(parentKey as CategoryKey)) {
    return `/shop?category=${parentKey}`;
  }
  if (ALL_CATEGORY_KEYS.includes(key as CategoryKey)) {
    return `/shop?category=${key}`;
  }
  return "/shop";
}

function parentKeyFor(subkey: string): string | null {
  for (const [parent, children] of Object.entries(CATEGORY_SUBKEYS)) {
    if (children.includes(subkey)) return parent;
  }
  return null;
}

/** Category lookup against an explicit catalogue (used by server-rendered pages). */
export function labelFor(categories: readonly CategoryOption[], key: string): string {
  const known = categories.find(c => c.key === key)?.label;
  if (known) return known;
  // A category present in the URL but not in the loaded taxonomy (a stale link, or
  // a link written against a different taxonomy) still gets a readable heading
  // instead of being mislabelled "All Products".
  const humanised = key.replace(/[-_]+/g, " ").trim();
  return humanised ? humanised.charAt(0).toUpperCase() + humanised.slice(1) : "All Products";
}

/**
 * Formats an amount in the currency it is stored in. No conversion happens
 * here: the catalogue stores amounts in store_settings.currency, and the
 * formatter only changes how that same number is presented.
 *
 * Formatting is delegated to the shared `lib/currency` formatter, so the
 * storefront, admin, emails and PDFs all label amounts the same way
 * ("2,499 MAD" in a MAD store, "$2,499.00" in a USD one). The en-US locale is
 * used so thousands separators are always commas and decimal separators are
 * always periods, regardless of the viewer's browser locale.
 */
export function formatPrice(value: number, currency = DEFAULT_CURRENCY): string {
  return formatMoney(value, currency);
}

export function imageUrl(file: string): string {
  if (!file) return "";
  if (/^(https?:)?\/\//.test(file) || file.startsWith("/")) return file;
  return `${ASSET}/${file}`;
}

/** Text search across title, category and short description. */
export function searchProducts(list: readonly Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...list];
  const terms = q.split(/\s+/);
  return list.filter(p => {
    const haystack = `${p.title} ${p.category} ${p.short} ${categoryLabel(p.category)}`.toLowerCase();
    return terms.every(t => haystack.includes(t));
  });
}

export type SortKey = "featured" | "price-asc" | "price-desc" | "rating" | "discount";

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "rating", label: "Top Rated" },
  { key: "discount", label: "Biggest Discount" },
];

function discountOf(p: Product): number {
  return p.oldPrice ? (p.oldPrice - p.price) / p.oldPrice : 0;
}

export function sortProducts(list: Product[], sort: SortKey): Product[] {
  const copy = [...list];
  switch (sort) {
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "rating":
      return copy.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    case "discount":
      return copy.sort((a, b) => discountOf(b) - discountOf(a));
    default:
      return copy;
  }
}

/* ------------------------------------------------------------------ */
/* catalogue-derived attributes                                        */
/* ------------------------------------------------------------------ */

/** Connectivity options the shop can offer. A product only carries one of
 *  these when its own specs say so, so the filter never invents hardware. */
export const CONNECTIVITY_VALUES = ["Wi-Fi", "Bluetooth", "USB", "HDMI", "LAN"] as const;

const CONNECTIVITY_SPEC_KEYS = /^(connectivity|connection|connections|ports?|interfaces?|features)$/i;
const COLOUR_SPEC_KEYS = /^(colou?rs?|finish|colourway)$/i;
const WARRANTY_SPEC_KEYS = /^warranty$/i;
const ORIGIN_SPEC_KEYS = /^(origin|country of origin|made in|manufactured in)$/i;

/** Swatch colours for the colour names the catalogue actually uses. Unknown
 *  names get a neutral swatch and keep their real label. */
const COLOUR_SWATCHES: Record<string, string> = {
  black: "#111111",
  white: "#ffffff",
  "space gray": "#6f6f73",
  "space grey": "#6f6f73",
  gray: "#8a8a8e",
  grey: "#8a8a8e",
  silver: "#c9c9ce",
  blue: "#2f5d9e",
  "dark blue": "#1b2a4a",
  navy: "#1b2a4a",
  pink: "#e9a4b8",
  red: "#c8322f",
  green: "#3f7d54",
  gold: "#d8b273",
  purple: "#6b4f9b",
  yellow: "#f2d04b",
  starlight: "#f0e7dc",
  graphite: "#4a4a4a",
  midnight: "#1f2733"
};

/** CSS colour for a catalogue colour name. */
export function colourHex(name: string): string {
  const key = name.trim().toLowerCase();
  const direct = COLOUR_SWATCHES[key];
  if (direct) return direct;
  for (const word of key.split(/[\s/+-]+/)) {
    const match = COLOUR_SWATCHES[word];
    if (match) return match;
  }
  return "#d4d4d8";
}

/** Colourways recorded for a product: variant options plus any "Colour"
 *  spec. Nothing is inferred from the title or the marketing copy. */
export function coloursOf(product: Product): string[] {
  const colours = new Map<string, string>();
  const add = (raw: string) => {
    const value = raw.trim();
    if (value && !colours.has(value.toLowerCase())) colours.set(value.toLowerCase(), value);
  };
  for (const colour of product.colours ?? []) add(colour);
  for (const [key, value] of product.specs) {
    if (!COLOUR_SPEC_KEYS.test(key.trim())) continue;
    for (const part of value.split(/[,/]|\band\b/)) add(part);
  }
  return [...colours.values()];
}

/** Warranty term recorded in the product specs, when present. */
export function warrantyOf(product: Product): string | null {
  const spec = product.specs.find(([key]) => WARRANTY_SPEC_KEYS.test(key.trim()));
  const value = spec?.[1]?.trim();
  return value ? value : null;
}

/** Country of origin: the explicit column first, then an origin spec. */
export function originOf(product: Product): string | null {
  const explicit = product.origin?.trim();
  if (explicit) return explicit;
  const spec = product.specs.find(([key]) => ORIGIN_SPEC_KEYS.test(key.trim()));
  const value = spec?.[1]?.trim();
  return value ? value : null;
}

/** Connectivity standards the product's own specs mention. */
export function connectivityOf(product: Product): string[] {
  const text = product.specs
    .filter(([key]) => CONNECTIVITY_SPEC_KEYS.test(key.trim()))
    .map(([, value]) => value)
    .join(" ")
    .toLowerCase();
  if (!text) return [];
  const found: string[] = [];
  if (/wi-?fi|802\.11|wireless lan/.test(text)) found.push("Wi-Fi");
  if (/bluetooth/.test(text)) found.push("Bluetooth");
  if (/\busb\b/.test(text)) found.push("USB");
  if (/\bhdmi\b/.test(text)) found.push("HDMI");
  if (/\blan\b|ethernet|rj-?45/.test(text)) found.push("LAN");
  return found;
}

/** True when the catalogue lists a higher compare-at price. */
export function isOnSale(product: Product): boolean {
  return typeof product.oldPrice === "number" && product.oldPrice > product.price;
}

/* ------------------------------------------------------------------ */
/* filtering, faceting and pagination                                  */
/* ------------------------------------------------------------------ */

/** One selectable value inside a facet, with how many products carry it. */
export type FacetValue = { value: string; count: number };

export type FacetGroup = { key: string; label: string; values: FacetValue[] };

export type CatalogueFilters = {
  q?: string;
  category?: string;
  brands?: string[];
  colours?: string[];
  /** Connectivity standards (Wi-Fi, Bluetooth, USB, HDMI, LAN). */
  connectivities?: string[];
  warranties?: string[];
  origins?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  minRating?: number;
  /** Technical filters, matched against the product's `specs` pairs. */
  specs?: { key: string; value: string }[];
};

const SPEC_SEPARATOR = "::";

/** Encode one technical filter as `Key::Value` for the `spec` URL parameter. */
export function encodeSpecParam(key: string, value: string): string {
  return `${key}${SPEC_SEPARATOR}${value}`;
}

/** Parse a `spec` URL parameter; returns null when malformed. */
export function parseSpecParam(raw: string): { key: string; value: string } | null {
  const index = raw.indexOf(SPEC_SEPARATOR);
  if (index <= 0) return null;
  const key = raw.slice(0, index).trim();
  const value = raw.slice(index + SPEC_SEPARATOR.length).trim();
  if (!key || !value) return null;
  return { key, value };
}

function specMatches(product: Product, key: string, value: string): boolean {
  const wantedKey = key.toLowerCase();
  const wantedValue = value.toLowerCase();
  return product.specs.some(
    ([specKey, specValue]) =>
      specKey.toLowerCase() === wantedKey && specValue.toLowerCase() === wantedValue
  );
}

/**
 * Applies every shop filter to a catalogue already held in memory, so filtering
 * costs no extra database round trips (the CPU budget matters here — see the
 * production stability reports).
 */
export function filterCatalogue(
  list: readonly Product[],
  filters: CatalogueFilters
): Product[] {
  let result = filters.q ? searchProducts(list, filters.q) : [...list];

  if (filters.category) result = result.filter(p => p.category === filters.category);

  if (filters.brands && filters.brands.length > 0) {
    const wanted = new Set(filters.brands.map(b => b.toLowerCase()));
    result = result.filter(p => Boolean(p.brand) && wanted.has(p.brand!.toLowerCase()));
  }

  if (filters.colours && filters.colours.length > 0) {
    const wanted = new Set(filters.colours.map(c => c.toLowerCase()));
    result = result.filter(p => coloursOf(p).some(c => wanted.has(c.toLowerCase())));
  }

  if (filters.connectivities && filters.connectivities.length > 0) {
    const wanted = new Set(filters.connectivities.map(v => v.toLowerCase()));
    result = result.filter(p => connectivityOf(p).some(v => wanted.has(v.toLowerCase())));
  }

  if (filters.warranties && filters.warranties.length > 0) {
    const wanted = new Set(filters.warranties.map(v => v.toLowerCase()));
    result = result.filter(p => {
      const value = warrantyOf(p);
      return value !== null && wanted.has(value.toLowerCase());
    });
  }

  if (filters.origins && filters.origins.length > 0) {
    const wanted = new Set(filters.origins.map(v => v.toLowerCase()));
    result = result.filter(p => {
      const value = originOf(p);
      return value !== null && wanted.has(value.toLowerCase());
    });
  }

  if (typeof filters.minPrice === "number") {
    const min = filters.minPrice;
    result = result.filter(p => p.price >= min);
  }
  if (typeof filters.maxPrice === "number") {
    const max = filters.maxPrice;
    result = result.filter(p => p.price <= max);
  }
  if (filters.inStockOnly) result = result.filter(p => p.stock > 0);
  if (filters.onSaleOnly) result = result.filter(isOnSale);

  if (typeof filters.minRating === "number") {
    const min = filters.minRating;
    result = result.filter(p => p.rating >= min);
  }

  for (const spec of filters.specs ?? []) {
    result = result.filter(p => specMatches(p, spec.key, spec.value));
  }

  return result;
}

/** The facet groups the shop sidebar renders, all derived from the catalogue. */
export type ShopFacets = {
  brands: FacetGroup | null;
  colours: FacetGroup | null;
  connectivity: FacetGroup | null;
  warranty: FacetGroup | null;
  origin: FacetGroup | null;
  availability: { onSale: number; inStock: number };
  /** Price bounds of the current scope, in whole dollars. */
  price: { min: number; max: number };
};

/**
 * Builds the facet groups for the current scope (usually one category).
 * Facets are derived from the products themselves, so a filter is only offered
 * when the catalogue can actually answer it. Brand and origin stay empty until
 * the database records them; the UI says so instead of inventing values.
 */
export function buildFacetGroups(scope: readonly Product[]): ShopFacets {
  const brands = new Map<string, number>();
  const colourCounts = new Map<string, number>();
  const connectivityCounts = new Map<string, number>();
  const warrantyCounts = new Map<string, number>();
  const originCounts = new Map<string, number>();
  let onSale = 0;
  let inStock = 0;
  let lowPrice = Number.POSITIVE_INFINITY;
  let highPrice = 0;

  const bump = (counts: Map<string, number>, value: string) =>
    counts.set(value, (counts.get(value) ?? 0) + 1);

  for (const product of scope) {
    if (product.brand) bump(brands, product.brand);
    for (const colour of coloursOf(product)) bump(colourCounts, colour);
    for (const value of connectivityOf(product)) bump(connectivityCounts, value);
    const warrantyValue = warrantyOf(product);
    if (warrantyValue) bump(warrantyCounts, warrantyValue);
    const originValue = originOf(product);
    if (originValue) bump(originCounts, originValue);
    if (isOnSale(product)) onSale += 1;
    if (product.stock > 0) inStock += 1;
    lowPrice = Math.min(lowPrice, product.price);
    highPrice = Math.max(highPrice, product.price);
  }

  const toFacet = (
    key: string,
    label: string,
    counts: Map<string, number>,
    limit: number
  ): FacetGroup | null => {
    if (counts.size === 0) return null;
    const values = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
      .slice(0, limit);
    return { key, label, values };
  };

  const min = scope.length > 0 ? Math.floor(lowPrice) : 0;
  const max = scope.length > 0 ? Math.ceil(highPrice) : 0;

  return {
    brands: toFacet("brand", "Brand", brands, 12),
    colours: toFacet("colour", "Colour", colourCounts, 12),
    connectivity: toFacet("connectivity", "Connectivity", connectivityCounts, CONNECTIVITY_VALUES.length),
    warranty: toFacet("warranty", "Warranty", warrantyCounts, 8),
    origin: toFacet("origin", "Origin", originCounts, 12),
    availability: { onSale, inStock },
    // A flat catalogue price still needs a movable track, so keep a 1-unit span.
    price: { min, max: max > min ? max : min + 1 }
  };
}

/** Default products per shop page. */
export const SHOP_PAGE_SIZE = 24;

export type Paged<T> = {
  items: T[];
  page: number;
  pages: number;
  total: number;
  perPage: number;
};

/** Slices a list into a page, clamping the requested page into range. */
export function paginate<T>(items: readonly T[], page: number, perPage = SHOP_PAGE_SIZE): Paged<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const start = (safePage - 1) * perPage;
  return { items: items.slice(start, start + perPage), page: safePage, pages, total, perPage };
}
