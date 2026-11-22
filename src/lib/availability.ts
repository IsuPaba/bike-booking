/**
 * Availability rules (BRL-008) — pure functions shared by the UI and create_booking.
 * For each day of a rental: units booked on active bookings + requested ≤ the listing's daily limit.
 * Active = awaiting_payment (held for 15 minutes only), confirmed, with_tourist.
 */
import { rentalDates } from "./pricing";
import type { Booking, DateStr } from "./types";

export const HOLD_MINUTES = 15;
const HOLD_MS = HOLD_MINUTES * 60_000;

type BookingLike = Pick<Booking, "id" | "status" | "created_at" | "start_date" | "end_date"> & { items: { listing_id: string }[] };

export const holdExpiresAt = (createdAt: string) => new Date(new Date(createdAt).getTime() + HOLD_MS);

export function holdsUnits(b: Pick<Booking, "status" | "created_at">, now: Date = new Date()): boolean {
  if (b.status === "confirmed" || b.status === "with_tourist") return true;
  if (b.status === "awaiting_payment") return holdExpiresAt(b.created_at).getTime() > now.getTime();
  return false;
}

/** Units of a listing booked on one calendar day. */
export function unitsBookedOn(listingId: string, day: DateStr, bookings: BookingLike[], now = new Date(), excludeId?: string): number {
  let n = 0;
  for (const b of bookings) {
    if (b.id === excludeId || !holdsUnits(b, now) || day < b.start_date || day > b.end_date) continue;
    for (const i of b.items) if (i.listing_id === listingId) n++;
  }
  return n;
}

/** listing_availability(): units free on the tightest day of the range. */
export function unitsFree(
  listing: { id: string; daily_limit: number },
  start: DateStr,
  end: DateStr,
  bookings: BookingLike[],
  now = new Date(),
  excludeId?: string,
): number {
  const tightest = Math.max(0, ...rentalDates(start, end).map((d) => unitsBookedOn(listing.id, d, bookings, now, excludeId)));
  return Math.max(0, listing.daily_limit - tightest);
}
