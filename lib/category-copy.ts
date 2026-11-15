/**
 * Short, neutral category blurbs for the category landing hero.
 *
 * These describe what the category is for — they make no claims about stock,
 * brands represented, prices or supplier relationships. A description stored
 * in `public.categories.description` (migration 0008) always wins over this
 * copy, so an operator can replace any of these lines from the admin once the
 * column exists.
 */
const DESCRIPTIONS: Record<string, string> = {
  computers: "Laptops, ultrabooks and mobile workstations for work, study and travel.",
  desktops: "Desktop towers, all-in-ones and workstations for office and home setups.",
  servers: "Rack, tower and storage servers for small-business and enterprise workloads.",
  networking: "Routers, switches, access points and cabling for reliable connectivity.",
  components: "Processors, memory, storage, graphics cards, cases and power supplies.",
  smartphones: "Phones and tablets, with the models and colourways currently in the catalogue.",
  wearables: "Smartwatches and fitness bands for everyday tracking and notifications.",
  gaming: "Gaming systems, consoles, displays, chairs and the accessories around them.",
  printers: "Printers, scanners, multifunction devices and the consumables they use.",
  monitors: "Office, design and gaming displays across the sizes we stock.",
  multimedia: "Headphones, earbuds, speakers and audio accessories.",
  peripherals: "Keyboards, mice, webcams, docks, cables and everyday accessories.",
  software: "Operating systems, productivity suites and security licences.",
  power: "UPS units, surge protection and power accessories for sensitive equipment.",
  // Legacy slugs (production before 0007 is applied)
  phones: "Phones and tablets, with the models and colourways currently in the catalogue.",
  laptops: "Laptops and mobile workstations for work, study and travel.",
  tablets: "Tablets and the accessories that go with them.",
  audio: "Headphones, earbuds, speakers and audio accessories."
};

const FALLBACK =
  "Browse the products currently listed in this category. Filters, sorting and stock information are live.";

export function categoryDescription(slug: string | undefined): string {
  if (!slug) return FALLBACK;
  return DESCRIPTIONS[slug] ?? FALLBACK;
}
