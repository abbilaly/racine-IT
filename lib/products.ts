export const ASSET = "https://wpglozin.com/electro/wp-content/uploads/sites/24/2025/05";
export const PAYMENTS = "https://wpglozin.com/electro/wp-content/uploads/sites/24/2025/03/payment.webp";

export type Product = {
  slug: string;
  title: string;
  category: string;
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
};

export const CATEGORIES = [
  { key: "phones", label: "Phones/Mobile" },
  { key: "laptops", label: "Macbook/PCs" },
  { key: "tablets", label: "Tablets/Ipad Pro" },
  { key: "audio", label: "Audio/Headphones" },
  { key: "wearables", label: "Watches/Wearables" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const products: Product[] = [
  {
    slug: "apple-iphone-13-mini-128gb-pink",
    title: "Apple iPhone 13 Mini 128GB Pink – Unlocked (Renewed)",
    category: "phones",
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
    category: "tablets",
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
    category: "tablets",
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
    category: "audio",
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
    category: "laptops",
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
    category: "phones",
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
    category: "audio",
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
    category: "laptops",
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
    category: "phones",
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
    category: "audio",
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

export function getProduct(slug: string): Product | undefined {
  return productMap[slug];
}

export function categoryLabel(key: string): string {
  return CATEGORIES.find(c => c.key === key)?.label ?? "All Products";
}

export function formatPrice(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function imageUrl(file: string): string {
  return `${ASSET}/${file}`;
}

/** Text search across title, category and short description. */
export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  const terms = q.split(/\s+/);
  return products.filter(p => {
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
