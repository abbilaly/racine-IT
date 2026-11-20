/**
 * Centralised money formatting for the whole application.
 *
 * Amounts are never converted here: a stored value is displayed in the store's
 * own currency (`store_settings.currency`). Switching that setting back to USD
 * therefore restores dollar formatting with no other change, because every
 * screen, email, PDF and admin table formats through this module.
 *
 * Two unit conventions exist and both are supported:
 *  - `formatMoney` / `formatAmount` take an amount in currency units (349.00).
 *  - `formatCents` takes integer cents (34900), which is how prices, orders,
 *    quotations and shipping fees are stored.
 */

/** Currency used when no store setting is available (offline demo catalogue). */
export const DEFAULT_CURRENCY = "USD";

const CURRENCY_CODE = /^[A-Z]{3}$/;

/** Currencies displayed with the ISO code after the amount ("349 MAD"). */
const TRAILING_CODE_CURRENCIES = new Set(["MAD"]);

/** Falls back to {@link DEFAULT_CURRENCY} for empty or malformed settings. */
export function normaliseCurrency(currency?: string | null): string {
  const code = (currency ?? "").trim().toUpperCase();
  return CURRENCY_CODE.test(code) ? code : DEFAULT_CURRENCY;
}

/** Groups digits the same way everywhere: commas for thousands, dot decimals. */
function group(value: number, fractionDigits: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(safe);
}

/**
 * Decimal places for an amount. MAD prices in this catalogue are whole
 * dirhams, so they read as "2,499 MAD" rather than "2,499.00 MAD"; a
 * fractional amount keeps its two decimals.
 */
function decimalsFor(code: string, value: number, requested?: number): number {
  if (typeof requested === "number") return Math.min(20, Math.max(0, requested));
  if (TRAILING_CODE_CURRENCIES.has(code) && Math.abs(value % 1) < 1e-9) return 0;
  return 2;
}

/**
 * Formats an amount in currency units for display, including the currency
 * label: "349 MAD", "2,499 MAD", or "$349.00" when the store uses USD.
 */
export function formatMoney(
  value: number,
  currency?: string | null,
  options: { fractionDigits?: number } = {}
): string {
  const code = normaliseCurrency(currency);
  const amount = Number.isFinite(value) ? value : 0;
  const fractionDigits = decimalsFor(code, amount, options.fractionDigits);

  if (TRAILING_CODE_CURRENCIES.has(code)) {
    return `${group(amount, fractionDigits)} ${code}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits
    }).format(amount);
  } catch {
    return `${code} ${group(amount, fractionDigits)}`;
  }
}

/** Formats integer cents for display, including the currency label. */
export function formatCents(
  cents: number,
  currency?: string | null,
  options: { fractionDigits?: number } = {}
): string {
  return formatMoney((Number.isFinite(cents) ? cents : 0) / 100, currency, options);
}

/**
 * Formats an amount without its currency label, for documents and templates
 * that print the ISO code separately ("{{amount}} {{currency}}").
 */
export function formatAmount(value: number, currency?: string | null): string {
  const code = normaliseCurrency(currency);
  const amount = Number.isFinite(value) ? value : 0;
  return group(amount, decimalsFor(code, amount));
}

/** Short form for chart axes and KPI deltas: "1.2K MAD", "$1.2K". */
export function formatMoneyCompact(value: number, currency?: string | null): string {
  const code = normaliseCurrency(currency);
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      notation: "compact",
      maximumFractionDigits: 1
    }).format(amount);
  } catch {
    return `${group(amount, 0)} ${code}`;
  }
}
