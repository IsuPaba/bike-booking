/** Booking rules from the SRS — pure functions used by the UI, the staff app and the database functions. */
import { fromLocalInput, scDate } from "./time";
import type { Booking, DateStr, Fulfilment, PickupPoint, Settings, TimeStr } from "./types";

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** FR-036: booking reference like BK-7K3F9Q */
export function makeReference(rand: () => number = Math.random): string {
  let r = "BK-";
  for (let i = 0; i < 6; i++) r += REF_ALPHABET[Math.floor(rand() * REF_ALPHABET.length)];
  return r;
}

/** BRL-006: random 4-digit PIN */
export const makePin = (rand: () => number = Math.random) => String(Math.floor(rand() * 10000)).padStart(4, "0");

export const MAX_PIN_ATTEMPTS = 5;

/** When the tourist needs the bicycles on the first day. */
export const startInstant = (b: Pick<Booking, "start_date" | "time_needed">) => fromLocalInput(`${b.start_date}T${b.time_needed}`)!;

/** Bikes are due back by the return time (setting) on the last day. */
export const returnDeadline = (endDate: DateStr, returnTime: TimeStr) => fromLocalInput(`${endDate}T${returnTime}`)!;

export function validateDates(start: DateStr | null, end: DateStr | null, now = new Date()): string | null {
  if (!start || !end) return "Choose your start and end dates.";
  if (start < scDate(now)) return "The start date can't be in the past.";
  if (end < start) return "The end date must be on or after the start date.";
  return null;
}

/** Minimum notice before the first-day time (settings differ for pickup and delivery). */
export function minNoticeError(start: DateStr, time: TimeStr, fulfilment: Fulfilment, s: Settings, now = new Date()): string | null {
  const hours = fulfilment === "pickup" ? s.booking_min_notice_hours_pickup : s.booking_min_notice_hours_delivery;
  const at = fromLocalInput(`${start}T${time}`);
  if (!at) return "Choose a time.";
  if (new Date(at).getTime() < now.getTime() + hours * 3_600_000)
    return fulfilment === "pickup"
      ? `Self-pickup needs at least ${hours} hours' notice. Please choose a later time or day.`
      : `Delivery needs at least ${hours} hours' notice so we can arrange your bicycles. Please choose a later time or day.`;
  return null;
}

export function withinOpeningHours(time: TimeStr, p: Pick<PickupPoint, "opens_at" | "closes_at">): boolean {
  return time >= p.opens_at && time <= p.closes_at;
}

/** Q8: free cancellation until N hours before the start; later it can't be cancelled online. */
export function guestCancellation(b: Booking, s: Settings, now = new Date()): { allowed: boolean; reason: string } {
  if (b.status !== "confirmed" && b.status !== "awaiting_payment")
    return { allowed: false, reason: "This booking can no longer be cancelled online." };
  const cutoff = new Date(startInstant(b)).getTime() - s.free_cancellation_hours * 3_600_000;
  if (now.getTime() > cutoff)
    return { allowed: false, reason: `Free cancellation ends ${s.free_cancellation_hours} hours before the start. Please contact us for help.` };
  return { allowed: true, reason: `Free cancellation until ${s.free_cancellation_hours} hours before your start time.` };
}

/** BRL-013: •••••4821 */
export const maskPassport = (p: string) => (p.length <= 4 ? "••••" : `•••••${p.slice(-4)}`);
export const maskPhone = (p: string) => p.replace(/\d(?=(?:\D*\d){3})/g, "•");

export interface HandoverEntry {
  item_id: string;
  vendor_id: string;
  bicycle_number: string;
}

/**
 * FR-040: the same bicycle number from the same vendor can't be on another booking that is with the tourist.
 * Also blocks the same number twice within this handover.
 */
export function handoverConflicts(bookingId: string, entries: HandoverEntry[], bookings: Booking[]): string[] {
  const errors: string[] = [];
  const key = (v: string, n: string) => `${v}::${n.trim().toUpperCase()}`;
  const seen = new Set<string>();
  for (const e of entries) {
    const k = key(e.vendor_id, e.bicycle_number);
    if (seen.has(k)) errors.push(`Bicycle ${e.bicycle_number} is entered twice.`);
    seen.add(k);
    const clash = bookings.find((b) => b.id !== bookingId && b.status === "with_tourist" &&
      b.items.some((i) => i.vendor_id === e.vendor_id && i.bicycle_number && key(i.vendor_id, i.bicycle_number) === k));
    if (clash) errors.push(`Bicycle ${e.bicycle_number} from this vendor is already out on booking ${clash.reference}.`);
  }
  return errors;
}

/** BRL-007: with_tourist only after the PIN matched and every bicycle has a number and vendor. */
export function handoverBlockers(b: Booking, entries: HandoverEntry[]): string[] {
  const out: string[] = [];
  if (b.is_locked) out.push("The booking is locked after too many wrong PINs. Ask the admin to unlock it.");
  if (!b.pin_verified_at) out.push("Check the guest's PIN first.");
  if (b.status !== "confirmed") out.push("Only confirmed bookings can be handed over.");
  for (const item of b.items) {
    const e = entries.find((x) => x.item_id === item.id);
    if (!e?.vendor_id || !e.bicycle_number.trim()) {
      out.push("Every bicycle needs a vendor and a bicycle number.");
      break;
    }
  }
  return out;
}

export const isLateReturn = (b: Pick<Booking, "end_date">, returnedAt: string, s: Settings) =>
  new Date(returnedAt).getTime() > new Date(returnDeadline(b.end_date, s.return_time)).getTime();
