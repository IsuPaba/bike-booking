/**
 * Reports and dashboard figures (FR-050, FR-053–FR-058) — pure functions over bookings.
 * Only completed and with_tourist bookings count as revenue; cancelled and no-show are counted separately.
 */
import { round2 } from "./money";
import { addDays, scDate } from "./time";
import type { Booking, Category, DateStr, Listing, Vendor } from "./types";

export const countsAsRevenue = (b: Booking) => b.status === "completed" || b.status === "with_tourist";
export const inRange = (b: Booking, from: DateStr, to: DateStr) => b.start_date >= from && b.start_date <= to;
const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));

export function rentalsSummary(bookings: Booking[], from: DateStr, to: DateStr) {
  const inPeriod = bookings.filter((b) => inRange(b, from, to));
  const rev = inPeriod.filter(countsAsRevenue);
  return {
    bookings: rev.length,
    bicycles: rev.reduce((s, b) => s + b.items.length, 0),
    rentalDays: rev.reduce((s, b) => s + b.items.reduce((n, i) => n + i.days, 0), 0),
    revenue: sum(rev.map((b) => b.total)),
    rentalRevenue: sum(rev.map((b) => b.total - b.delivery_fee)),
    deliveryFees: sum(rev.map((b) => b.delivery_fee)),
    discounts: sum(rev.map((b) => b.discount_total)),
    commission: sum(rev.flatMap((b) => b.items.map((i) => i.commission_amount ?? 0))),
    cancelled: inPeriod.filter((b) => b.status === "cancelled").length,
    noShow: inPeriod.filter((b) => b.status === "no_show").length,
    upcoming: inPeriod.filter((b) => b.status === "confirmed").length,
  };
}

export function byVendor(bookings: Booking[], vendors: Vendor[], from: DateStr, to: DateStr) {
  const items = bookings.filter((b) => inRange(b, from, to) && countsAsRevenue(b)).flatMap((b) => b.items);
  const rows = [...vendors.map((v) => ({ id: v.id, name: v.business_name })), { id: null, name: "Not assigned" }].map((v) => {
    const own = items.filter((i) => i.vendor_id === v.id);
    const revenue = sum(own.map((i) => i.line_total));
    const commission = sum(own.map((i) => i.commission_amount ?? 0));
    return { vendor: v.name, vendorId: v.id, bicycles: own.length, rentalDays: own.reduce((s, i) => s + i.days, 0), revenue, commission, owed: round2(revenue - commission) };
  });
  return rows.filter((r) => r.vendorId !== null || r.bicycles > 0);
}

export function byCategory(bookings: Booking[], listings: Listing[], categories: Category[], from: DateStr, to: DateStr) {
  const items = bookings.filter((b) => inRange(b, from, to) && countsAsRevenue(b)).flatMap((b) => b.items);
  return categories.map((c) => {
    const ids = new Set(listings.filter((l) => l.category_id === c.id).map((l) => l.id));
    const own = items.filter((i) => ids.has(i.listing_id));
    return { category: c.name, bicycles: own.length, rentalDays: own.reduce((s, i) => s + i.days, 0), revenue: sum(own.map((i) => i.line_total)) };
  });
}

export function byFulfilment(bookings: Booking[], from: DateStr, to: DateStr) {
  const rev = bookings.filter((b) => inRange(b, from, to) && countsAsRevenue(b));
  return (["pickup", "delivery"] as const).map((f) => {
    const own = rev.filter((b) => b.fulfilment === f);
    return { method: f === "pickup" ? "Self-pickup" : "Delivery", bookings: own.length, bicycles: own.reduce((s, b) => s + b.items.length, 0), revenue: sum(own.map((b) => b.total)) };
  });
}

export function byPaymentMethod(bookings: Booking[], from: DateStr, to: DateStr) {
  const rev = bookings.filter((b) => inRange(b, from, to) && countsAsRevenue(b));
  return [
    { method: "Online (card / Google Pay)", own: rev.filter((b) => b.payment_method !== "cash") },
    { method: "Cash at handover", own: rev.filter((b) => b.payment_method === "cash") },
  ].map(({ method, own }) => ({ method, bookings: own.length, revenue: sum(own.map((b) => b.total)) }));
}

export function vendorStatement(bookings: Booking[], listings: Listing[], vendorId: string, from: DateStr, to: DateStr) {
  const lines = bookings
    .filter((b) => inRange(b, from, to) && countsAsRevenue(b))
    .flatMap((b) => b.items.filter((i) => i.vendor_id === vendorId).map((i) => ({
      reference: b.reference, start: b.start_date, end: b.end_date,
      bicycle: listings.find((l) => l.id === i.listing_id)?.name ?? "Bicycle", bicycleNumber: i.bicycle_number ?? "—",
      days: i.days, rental: i.line_total, commission: i.commission_amount ?? 0, net: round2(i.line_total - (i.commission_amount ?? 0)),
    })))
    .sort((a, b) => a.start.localeCompare(b.start));
  return { lines, totals: { bicycles: lines.length, days: lines.reduce((s, l) => s + l.days, 0), rental: sum(lines.map((l) => l.rental)), commission: sum(lines.map((l) => l.commission)), net: sum(lines.map((l) => l.net)) } };
}

export function toCsv(rows: Record<string, string | number | null>[]): string {
  if (!rows.length) return "";
  const head = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head.join(","), ...rows.map((r) => head.map((h) => cell(r[h])).join(","))].join("\n");
}

export function dashboard(bookings: Booking[], now = new Date()) {
  const today = scDate(now);
  const month = today.slice(0, 7);
  const active = bookings.filter((b) => b.status !== "cancelled" && b.status !== "awaiting_payment");
  const handoversToday = active.filter((b) => b.start_date === today && (b.status === "confirmed" || b.status === "with_tourist"));
  const thisMonth = bookings.filter((b) => b.start_date.startsWith(month));
  const revMonth = thisMonth.filter(countsAsRevenue);
  return {
    pickupsToday: handoversToday.filter((b) => b.fulfilment === "pickup"),
    deliveriesToday: handoversToday.filter((b) => b.fulfilment === "delivery"),
    returnsToday: active.filter((b) => b.end_date === today && (b.status === "with_tourist" || b.status === "completed")),
    bicyclesOut: bookings.filter((b) => b.status === "with_tourist").reduce((s, b) => s + b.items.length, 0),
    bookingsThisMonth: thisMonth.filter((b) => b.status !== "cancelled" && b.status !== "awaiting_payment").length,
    revenueThisMonth: sum(revMonth.map((b) => b.total)),
    commissionThisMonth: sum(revMonth.flatMap((b) => b.items.map((i) => i.commission_amount ?? 0))),
    cashDueToday: sum(handoversToday.filter((b) => b.payment_status === "cash_due").map((b) => b.total)),
    locked: bookings.filter((b) => b.is_locked),
    needsVendor: bookings.filter((b) => b.status === "confirmed" && b.items.some((i) => !i.vendor_id)).sort((a, b) => a.start_date.localeCompare(b.start_date)),
  };
}

export function bookingsPerDay(bookings: Booking[], days = 30, now = new Date()) {
  const today = scDate(now);
  const series = Array.from({ length: days }, (_, i) => ({ date: addDays(today, i - days + 1), count: 0 }));
  const idx = new Map(series.map((d, i) => [d.date, i]));
  bookings.forEach((b) => {
    const i = idx.get(scDate(b.created_at));
    if (i !== undefined && b.status !== "awaiting_payment") series[i].count++;
  });
  return series;
}

export type DiscountStatus = "Scheduled" | "Live" | "Expired" | "Inactive";
export function discountStatus(d: { is_active: boolean; starts_on: string; ends_on: string }, now = new Date()): DiscountStatus {
  if (!d.is_active) return "Inactive";
  const t = scDate(now);
  return t < d.starts_on ? "Scheduled" : t > d.ends_on ? "Expired" : "Live";
}
