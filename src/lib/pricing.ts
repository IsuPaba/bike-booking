/**
 * Pricing rules — pure, framework-free (reused by the future mobile app and by create_booking).
 *
 * BRL-001 Price is per CALENDAR DAY: days charged = (end date − start date) + 1.
 * BRL-005 A seasonal discount applies to each rental day inside its date range.
 * BRL-004 Only the single best discount applies per bicycle per day; never stacked.
 * Booking total = sum of bicycle lines + delivery fee (if delivery).
 */
import { formatMoneyCompact as $, round2 } from "./money";
import { addDays, formatDate } from "./time";
import type { CommissionType, DateStr, Discount, Fulfilment, Listing } from "./types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Inclusive calendar days between two dates. Same-day rental = 1 day. */
export function daysCharged(start: DateStr, end: DateStr): number {
  const ms = new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/** Every calendar date of a rental, first to last. */
export function rentalDates(start: DateStr, end: DateStr): DateStr[] {
  return Array.from({ length: daysCharged(start, end) }, (_, i) => addDays(start, i));
}

type ListingLike = Pick<Listing, "id" | "category_id" | "daily_price" | "name">;

export function discountApplies(d: Discount, listing: ListingLike, day: DateStr): boolean {
  if (!d.is_active || day < d.starts_on || day > d.ends_on) return false;
  if (d.scope === "categories") return d.category_ids.includes(listing.category_id);
  if (d.scope === "listings") return d.listing_ids.includes(listing.id);
  return true;
}

/** Discount for ONE bicycle on ONE day, capped at the daily price. */
export function discountAmountPerDay(d: Discount, dailyPrice: number): number {
  const raw = d.discount_type === "percentage" ? (dailyPrice * d.value) / 100 : d.value;
  return round2(Math.min(Math.max(raw, 0), dailyPrice));
}

/** BRL-004: the single best discount for one bicycle on one day (or null). */
export function bestDiscountForDay(listing: ListingLike, day: DateStr, discounts: Discount[]): { discount: Discount; amount: number } | null {
  let best: { discount: Discount; amount: number } | null = null;
  for (const d of discounts) {
    if (!discountApplies(d, listing, day)) continue;
    const amount = discountAmountPerDay(d, listing.daily_price);
    if (!best || amount > best.amount) best = { discount: d, amount };
  }
  return best;
}

/** "−15%" or "−$3/day" */
export function discountLabel(d: Pick<Discount, "discount_type" | "value">): string {
  return d.discount_type === "percentage" ? `−${d.value}%` : `−${$(d.value)}/day`;
}

/** Price after the best discount on a given day — used for the crossed-out price on cards (FR-011). */
export function priceOnDay(listing: ListingLike, day: DateStr, discounts: Discount[]) {
  const best = bestDiscountForDay(listing, day, discounts);
  return { price: round2(listing.daily_price - (best?.amount ?? 0)), original: listing.daily_price, discount: best?.discount ?? null };
}

export interface LineQuote {
  listing_id: string;
  quantity: number;
  days: number;
  unit_price: number;
  /** Discount for one bicycle over the whole rental */
  discount_per_bike: number;
  /** Discount for all bicycles on this line */
  discount_amount: number;
  gross: number;
  line_total: number;
  /** One bicycle's share, stored on each booking_item */
  per_bike_total: number;
  breakdown: string;
}

/** Price one cart line: quantity × days × daily price, minus the best discount on each day. */
export function priceLine(listing: ListingLike, quantity: number, start: DateStr, end: DateStr, discounts: Discount[]): LineQuote {
  const qty = Math.max(1, Math.floor(quantity));
  const dates = rentalDates(start, end);
  const groups = new Map<string, { discount: Discount; days: number; amount: number }>();
  let perBike = 0;
  for (const day of dates) {
    const best = bestDiscountForDay(listing, day, discounts);
    if (!best) continue;
    perBike += best.amount;
    const g = groups.get(best.discount.id) ?? { discount: best.discount, days: 0, amount: 0 };
    g.days += 1;
    g.amount += best.amount;
    groups.set(best.discount.id, g);
  }
  const gross = round2(qty * dates.length * listing.daily_price);
  const discountAmount = round2(perBike * qty);
  let breakdown = `${qty} × ${listing.name} × ${plural(dates.length, "day")} × ${$(listing.daily_price)} = ${$(gross)}`;
  for (const g of groups.values()) {
    breakdown += ` · ${g.discount.name} ${discountLabel(g.discount)} on ${plural(g.days, "day")} = −${$(round2(g.amount * qty))}`;
  }
  return {
    listing_id: listing.id,
    quantity: qty,
    days: dates.length,
    unit_price: listing.daily_price,
    discount_per_bike: round2(perBike),
    discount_amount: discountAmount,
    gross,
    line_total: round2(gross - discountAmount),
    per_bike_total: round2(dates.length * listing.daily_price - perBike),
    breakdown,
  };
}

export interface CartLineInput {
  listing: ListingLike;
  quantity: number;
}

export interface CartQuote {
  days: number;
  lines: LineQuote[];
  subtotal: number;
  discount_total: number;
  delivery_fee: number;
  total: number;
  bicycles: number;
}

export function quoteCart(
  lines: CartLineInput[],
  start: DateStr,
  end: DateStr,
  discounts: Discount[],
  fulfilment: Fulfilment | null = null,
  deliveryFee = 0,
): CartQuote {
  const quoted = lines.map((l) => priceLine(l.listing, l.quantity, start, end, discounts));
  const subtotal = round2(quoted.reduce((s, l) => s + l.gross, 0));
  const discount_total = round2(quoted.reduce((s, l) => s + l.discount_amount, 0));
  const delivery_fee = fulfilment === "delivery" ? round2(deliveryFee) : 0;
  return {
    days: daysCharged(start, end),
    lines: quoted,
    subtotal,
    discount_total,
    delivery_fee,
    total: round2(subtotal - discount_total + delivery_fee),
    bicycles: quoted.reduce((s, l) => s + l.quantity, 0),
  };
}

/** Commission on one booked bicycle (BRL-012 snapshot values). */
export function commissionFor(type: CommissionType, value: number, bikeRentalAmount: number, days: number): number {
  return round2(type === "percentage" ? (bikeRentalAmount * value) / 100 : value * days);
}

export function commissionLabel(type: CommissionType, value: number): string {
  return type === "percentage" ? `${value}%` : `${$(value)} per bike-day`;
}

/** Plain-English summary, e.g. "15% off Electric bikes, 1 Dec 2026 – 15 Jan 2027". */
export function describeDiscount(
  d: Pick<Discount, "discount_type" | "value" | "scope" | "category_ids" | "listing_ids" | "starts_on" | "ends_on">,
  names: { categories: Record<string, string>; listings: Record<string, string> },
): string {
  const amount = d.discount_type === "percentage" ? `${d.value || 0}% off` : `${$(d.value || 0)} off per bike per day`;
  const pick = (ids: string[], map: Record<string, string>) => ids.map((id) => map[id]).filter(Boolean).join(", ");
  const target =
    d.scope === "all" ? "all bikes"
    : d.scope === "categories" ? `${pick(d.category_ids, names.categories) || "chosen categories (none yet)"} bikes`
    : pick(d.listing_ids, names.listings) || "chosen bicycles (none yet)";
  const dates = d.starts_on && d.ends_on ? `, ${formatDate(d.starts_on)} – ${formatDate(d.ends_on)}` : "";
  return `${amount} ${target}${dates}`;
}

export function lowestDailyPrice(listings: Pick<Listing, "daily_price">[]): number | null {
  return listings.length ? Math.min(...listings.map((l) => l.daily_price)) : null;
}
