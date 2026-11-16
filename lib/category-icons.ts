import {
  AppWindow,
  BatteryCharging,
  Cpu,
  Gamepad2,
  HardDrive,
  Headphones,
  Keyboard,
  Laptop,
  LayoutGrid,
  Monitor,
  Printer,
  Router,
  Server,
  Smartphone,
  Tablet,
  Watch,
  type LucideIcon
} from "lucide-react";

/**
 * Icons for the storefront category navigation.
 *
 * Keyed by category slug so the rail keeps working after the taxonomy is
 * renamed in the database: the approved 14-category slugs
 * (migration 0007_categories_taxonomy.sql) and the five legacy slugs still
 * present in production are both mapped. Unknown slugs fall back to a grid
 * icon instead of rendering nothing.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Approved taxonomy (0007)
  computers: Laptop,
  desktops: Monitor,
  servers: Server,
  networking: Router,
  components: Cpu,
  smartphones: Smartphone,
  wearables: Watch,
  gaming: Gamepad2,
  printers: Printer,
  monitors: Monitor,
  multimedia: Headphones,
  peripherals: Keyboard,
  software: AppWindow,
  power: BatteryCharging,
  // Legacy slugs still live until 0007 is applied
  phones: Smartphone,
  laptops: Laptop,
  tablets: Tablet,
  audio: Headphones
};

/**
 * Icon keys an operator can choose in the admin (migration 0008
 * `categories.icon`). Every key here is also the label shown in the picker.
 */
const ICON_BY_KEY: Record<string, LucideIcon> = {
  laptop: Laptop,
  desktop: Monitor,
  server: Server,
  router: Router,
  cpu: Cpu,
  smartphone: Smartphone,
  tablet: Tablet,
  watch: Watch,
  gamepad: Gamepad2,
  printer: Printer,
  monitor: Monitor,
  headset: Headphones,
  keyboard: Keyboard,
  storage: HardDrive,
  app: AppWindow,
  battery: BatteryCharging
};

/** Keys offered by the admin category icon picker. */
export const CATEGORY_ICON_KEYS = Object.keys(ICON_BY_KEY);

/**
 * Resolves the icon for a category: an operator-chosen key wins, then the
 * built-in mapping for the slug, then a neutral grid icon. Unknown keys are
 * ignored rather than rendered as empty space.
 */
export function categoryIcon(slug: string, iconKey?: string | null): LucideIcon {
  if (iconKey && ICON_BY_KEY[iconKey]) return ICON_BY_KEY[iconKey];
  return CATEGORY_ICONS[slug] ?? LayoutGrid;
}

/** Extra icon used by storage-flavoured subcategories, kept for future use. */
export const STORAGE_ICON = HardDrive;
