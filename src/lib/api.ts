/**
 * API layer — the only module that touches the data store. Each function mirrors a
 * database function or a table read/write from the brief and enforces the same rules
 * Row Level Security would:
 *  - public: active listings, categories, images, live discounts, pickup points, hotels, settings;
 *  - guests see a booking only with reference + email;
 *  - handover staff: today's handovers/returns only, no prices, reports or settings;
 *  - admin: everything.
 * Swapping in a hosted backend later only touches this file.
 */
import { z } from "zod";
import { holdExpiresAt, unitsFree } from "./availability";
import { getDb, newId, resetDatabase, transaction } from "./db";
import { cancellationEmail, confirmationEmail, receiptEmail } from "./emails";
import { commissionFor, quoteCart, type CartQuote } from "./pricing";
import {
  MAX_PIN_ATTEMPTS, guestCancellation, handoverBlockers, handoverConflicts, makePin, makeReference, minNoticeError,
  validateDates, withinOpeningHours, type HandoverEntry,
} from "./rules";
import { DEMO_BOOKINGS } from "./seed";
import { scDate } from "./time";
import type {
  Booking, Category, Database, Discount, EmailOutbox, Hotel, Listing, ListingImage, PaymentMethod, PickupPoint, Role, Settings, User, Vendor,
} from "./types";

export class ApiError extends Error {}

const latency = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const byOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;
const clone = <T,>(v: T): T => structuredClone(v);

// ------------------------------------------------------------------ auth (simulated)

const SESSION_KEY = "rideeasy-session";

export function currentUser(): User | null {
  try {
    const id = window.sessionStorage.getItem(SESSION_KEY);
    return getDb().users.find((u) => u.id === id) ?? null;
  } catch {
    return null;
  }
}

/** has_role() — roles live in their own table, never on the user row. */
export const hasRole = (userId: string | undefined, role: Role, db: Database = getDb()) =>
  !!userId && db.user_roles.some((r) => r.user_id === userId && r.role === role);

export const isAdmin = () => hasRole(currentUser()?.id, "admin");
export const isStaff = () => isAdmin() || hasRole(currentUser()?.id, "handover_staff");

function requireAdmin() {
  if (!isAdmin()) throw new ApiError("You need to be signed in as an admin to do that.");
  return currentUser()!;
}
function requireStaff() {
  if (!isStaff()) throw new ApiError("You need to be signed in as handover staff to do that.");
  return currentUser()!;
}

export async function signIn(email: string, password: string): Promise<Role[]> {
  await latency(350);
  const db = getDb();
  const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);
  if (!user) throw new ApiError("That email and password don't match. Please try again.");
  const roles = db.user_roles.filter((r) => r.user_id === user.id).map((r) => r.role);
  if (!roles.length) throw new ApiError("This account has no access yet. Ask the admin to assign a role.");
  window.sessionStorage.setItem(SESSION_KEY, user.id);
  return roles;
}

export function signOut() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

function audit(db: Database, action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  db.audit_log.push({ id: newId("au"), actor_id: currentUser()?.id ?? "guest", action, entity, entity_id: entityId, details, created_at: new Date().toISOString() });
}

function sendEmail(db: Database, b: Booking, kind: EmailOutbox["kind"], content: { subject: string; body_html: string }) {
  db.email_outbox.push({ id: newId("em"), booking_id: b.id, to_email: b.guest_email, kind, created_at: new Date().toISOString(), ...content });
}

// ------------------------------------------------------------------ public reads

const today = () => scDate(new Date());

export async function getSettings(): Promise<Settings> {
  await latency(60);
  return clone(getDb().settings);
}

export async function listCategories(): Promise<Category[]> {
  await latency();
  return [...getDb().categories].sort(byOrder);
}

export async function listListings(opts: { includeInactive?: boolean } = {}): Promise<Listing[]> {
  await latency();
  const all = opts.includeInactive && isAdmin();
  return getDb().listings.filter((l) => all || l.is_active).sort(byOrder);
}

export async function getListingBySlug(slug: string): Promise<Listing | null> {
  await latency();
  return getDb().listings.find((l) => l.slug === slug && (l.is_active || isAdmin())) ?? null;
}

export async function getListingById(id: string): Promise<Listing | null> {
  await latency(100);
  return getDb().listings.find((l) => l.id === id && (l.is_active || isAdmin())) ?? null;
}

export async function listListingImages(listingId?: string): Promise<ListingImage[]> {
  await latency(60);
  return getDb().listing_images.filter((i) => !listingId || i.listing_id === listingId).sort(byOrder);
}

export function primaryImageFor(listingId: string, images: ListingImage[]): string | null {
  const own = images.filter((i) => i.listing_id === listingId).sort(byOrder);
  return (own.find((i) => i.is_primary) ?? own[0])?.storage_path ?? null;
}

/** Live and upcoming active discounts — prices are calculated against these. */
export async function listPublicDiscounts(): Promise<Discount[]> {
  await latency(60);
  return getDb().discounts.filter((d) => d.is_active && d.ends_on >= today());
}

export async function listPickupPoints(): Promise<PickupPoint[]> {
  await latency(60);
  return getDb().pickup_points.filter((p) => p.is_active || isAdmin());
}

export async function listHotels(): Promise<Hotel[]> {
  await latency(60);
  return getDb().hotels.filter((h) => h.is_active || isAdmin()).sort((a, b) => a.name.localeCompare(b.name));
}

/** listing_availability(listing_id, start_date, end_date) */
export async function listingAvailability(listingId: string, start: string, end: string): Promise<number> {
  await latency(120);
  const db = getDb();
  const l = db.listings.find((x) => x.id === listingId);
  return l ? unitsFree(l, start, end, db.bookings) : 0;
}

export async function availabilityForAll(start: string, end: string): Promise<Record<string, number>> {
  await latency(120);
  const db = getDb();
  return Object.fromEntries(db.listings.map((l) => [l.id, unitsFree(l, start, end, db.bookings)]));
}

// ------------------------------------------------------------------ bookings (guest)

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
export const createBookingSchema = z.object({
  lines: z.array(z.object({ listing_id: z.string(), quantity: z.number().int().min(1).max(20) })).min(1),
  start_date: z.string().regex(dateRe),
  end_date: z.string().regex(dateRe),
  guest_name: z.string().trim().min(2).max(100),
  guest_phone: z.string().trim().min(6).max(30),
  guest_email: z.string().trim().email(),
  guest_passport: z.string().trim().min(5).max(20),
  hotel_id: z.string().nullable(),
  hotel_other_name: z.string().trim().max(100).nullable(),
  room: z.string().trim().min(1).max(40),
  fulfilment: z.enum(["pickup", "delivery"]),
  pickup_point_id: z.string().nullable(),
  time_needed: z.string().regex(/^\d{2}:\d{2}$/),
  payment_method: z.enum(["card", "google_pay", "cash"]),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

function priceBooking(db: Database, lines: { listing_id: string; quantity: number }[], start: string, end: string, fulfilment: "pickup" | "delivery"): CartQuote {
  const listings = lines.map((l) => {
    const listing = db.listings.find((x) => x.id === l.listing_id && x.is_active);
    if (!listing) throw new ApiError("One of the bicycles in your cart is no longer available.");
    return { listing, quantity: l.quantity };
  });
  return quoteCart(listings, start, end, db.discounts.filter((d) => d.is_active), fulfilment, db.settings.delivery_fee);
}

/**
 * create_booking(): checks minimum notice and availability on every day, recalculates
 * prices server-side, then creates booking + items + PIN + reference in one transaction.
 */
export async function createBooking(input: CreateBookingInput): Promise<{ reference: string }> {
  await latency(500);
  const d = createBookingSchema.parse(input);
  return transaction((db) => {
    const s = db.settings;
    const dateError = validateDates(d.start_date, d.end_date);
    if (dateError) throw new ApiError(dateError);
    const notice = minNoticeError(d.start_date, d.time_needed, d.fulfilment, s);
    if (notice) throw new ApiError(notice);
    if (d.fulfilment === "pickup") {
      const p = db.pickup_points.find((x) => x.id === d.pickup_point_id && x.is_active);
      if (!p) throw new ApiError("Choose a pickup point.");
      if (!withinOpeningHours(d.time_needed, p)) throw new ApiError(`${p.name} is open ${p.opens_at}–${p.closes_at}.`);
    } else if (!d.hotel_id && !d.hotel_other_name) {
      throw new ApiError("Tell us which hotel to deliver to.");
    }

    // Merge duplicate lines, then check each listing's daily limit on every day
    const merged = new Map<string, number>();
    d.lines.forEach((l) => merged.set(l.listing_id, (merged.get(l.listing_id) ?? 0) + l.quantity));
    for (const [id, qty] of merged) {
      const listing = db.listings.find((x) => x.id === id);
      const free = listing ? unitsFree(listing, d.start_date, d.end_date, db.bookings) : 0;
      if (free < qty) throw new ApiError(`${listing?.name ?? "A bicycle"}: only ${free} available for these dates.`);
    }

    const lines = [...merged].map(([listing_id, quantity]) => ({ listing_id, quantity }));
    const q = priceBooking(db, lines, d.start_date, d.end_date, d.fulfilment);
    let reference = makeReference();
    while (db.bookings.some((b) => b.reference === reference)) reference = makeReference();
    const id = newId("bk");
    const cash = d.payment_method === "cash";
    const b: Booking = {
      id, reference, pin: makePin(), pin_attempts: 0, is_locked: false, pin_verified_at: null,
      status: cash ? "confirmed" : "awaiting_payment", payment_status: cash ? "cash_due" : "unpaid", payment_method: d.payment_method,
      guest_name: d.guest_name, guest_phone: d.guest_phone, guest_email: d.guest_email.toLowerCase(), guest_passport: d.guest_passport.toUpperCase(),
      hotel_id: d.hotel_id, hotel_other_name: d.hotel_id ? null : d.hotel_other_name, room: d.room,
      start_date: d.start_date, end_date: d.end_date, fulfilment: d.fulfilment, pickup_point_id: d.fulfilment === "pickup" ? d.pickup_point_id : null,
      time_needed: d.time_needed, subtotal: q.subtotal, discount_total: q.discount_total, delivery_fee: q.delivery_fee, total: q.total,
      cash_collected_amount: null, cancellation_reason: null, internal_notes: null, created_at: new Date().toISOString(),
      handed_over_at: null, returned_at: null,
      items: q.lines.flatMap((line) => Array.from({ length: line.quantity }, (_, n) => ({
        id: `${id}-${line.listing_id}-${n + 1}`, booking_id: id, listing_id: line.listing_id, unit_price: line.unit_price, days: line.days,
        discount_amount: line.discount_per_bike, line_total: line.per_bike_total, price_breakdown: { text: line.breakdown },
        vendor_id: null, commission_type: null, commission_value: null, commission_amount: null, bicycle_number: null, condition_notes: null,
      }))),
    };
    db.bookings.push(b);
    if (cash) sendEmail(db, b, "confirmation", confirmationEmail(b, s, db.listings, db.pickup_points, db.hotels));
    audit(db, "booking_created", "booking", id, { reference, total: b.total, payment_method: b.payment_method });
    return { reference };
  });
}

const sameRef = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();
const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function findOwn(db: Database, reference: string, email: string): Booking {
  const b = db.bookings.find((x) => sameRef(x.reference, reference) && sameEmail(x.guest_email, email));
  if (!b) throw new ApiError("We couldn't find that booking.");
  return b;
}

/** get_booking_by_reference(reference, email) */
export async function getBookingByReference(reference: string, email: string): Promise<Booking | null> {
  await latency(300);
  return clone(getDb().bookings.find((b) => sameRef(b.reference, reference) && sameEmail(b.guest_email, email)) ?? null);
}

/** PROTOTYPE ONLY: the fixed demo bookings (reference + email) shown on Find my booking. Remove for production. */
export async function listDemoBookings() {
  await latency(60);
  const db = getDb();
  return DEMO_BOOKINGS.flatMap((d) => {
    const b = db.bookings.find((x) => x.reference === d.reference);
    return b ? [{ reference: b.reference, email: b.guest_email, what: d.what, pin: d.pin }] : [];
  });
}

/** Simulated online payment. No real money is charged. */
export async function payBooking(reference: string, email: string, method: Exclude<PaymentMethod, "cash">, approved: boolean): Promise<Booking> {
  await latency(1100);
  return transaction((db) => {
    const b = findOwn(db, reference, email);
    if (b.status !== "awaiting_payment") throw new ApiError("This booking has already been paid.");
    if (holdExpiresAt(b.created_at).getTime() < Date.now()) {
      for (const id of new Set(b.items.map((i) => i.listing_id))) {
        const l = db.listings.find((x) => x.id === id)!;
        const need = b.items.filter((i) => i.listing_id === id).length;
        if (unitsFree(l, b.start_date, b.end_date, db.bookings, new Date(), b.id) < need)
          throw new ApiError("Your 15-minute hold has expired and some bicycles have since been booked. Please choose new dates.");
      }
    }
    b.payment_method = method;
    db.payments.push({ id: newId("pay"), booking_id: b.id, amount: b.total, method, status: approved ? "succeeded" : "failed",
      provider_reference: `sim_${Math.random().toString(36).slice(2, 10)}`, created_at: new Date().toISOString() });
    if (!approved) return clone(b);
    b.status = "confirmed";
    b.payment_status = "paid";
    sendEmail(db, b, "confirmation", confirmationEmail(b, db.settings, db.listings, db.pickup_points, db.hotels));
    sendEmail(db, b, "receipt", receiptEmail(b, db.settings));
    audit(db, "payment", "booking", b.id, { amount: b.total, method });
    return clone(b);
  });
}

/** "Pay cash instead" from the payment page. */
export async function switchToCash(reference: string, email: string): Promise<void> {
  await latency(400);
  transaction((db) => {
    const b = findOwn(db, reference, email);
    if (b.status !== "awaiting_payment") throw new ApiError("This booking can't be changed now.");
    b.payment_method = "cash";
    b.payment_status = "cash_due";
    b.status = "confirmed";
    sendEmail(db, b, "confirmation", confirmationEmail(b, db.settings, db.listings, db.pickup_points, db.hotels));
    audit(db, "payment_method_changed", "booking", b.id, { to: "cash" });
  });
}

/** cancel_booking_by_guest(reference, email) — enforces the free-cancellation window. */
export async function cancelBookingByGuest(reference: string, email: string): Promise<Booking> {
  await latency(400);
  return transaction((db) => {
    const b = findOwn(db, reference, email);
    const c = guestCancellation(b, db.settings);
    if (!c.allowed) throw new ApiError(c.reason);
    b.status = "cancelled";
    b.cancellation_reason = "Cancelled by guest";
    sendEmail(db, b, "cancellation", cancellationEmail(b, db.settings));
    audit(db, "cancellation", "booking", b.id, { by: "guest" });
    return clone(b);
  });
}

// ------------------------------------------------------------------ handover staff

export interface StaffBooking extends Booking {
  hotel_name: string | null;
  pickup_point_name: string | null;
}

function staffView(db: Database, b: Booking): StaffBooking {
  return {
    ...clone(b),
    hotel_name: b.hotel_id ? db.hotels.find((h) => h.id === b.hotel_id)?.name ?? null : b.hotel_other_name,
    pickup_point_name: db.pickup_points.find((p) => p.id === b.pickup_point_id)?.name ?? null,
  };
}

/** Lookups staff need (no prices, settings or reports beyond the return time). */
export async function staffLookups() {
  requireStaff();
  await latency(80);
  const db = getDb();
  return {
    listings: db.listings.map((l) => ({ id: l.id, name: l.name })),
    vendors: db.vendors.filter((v) => v.is_active).map((v) => ({ id: v.id, business_name: v.business_name })),
    return_time: db.settings.return_time,
  };
}

export async function staffDay(date: string) {
  requireStaff();
  await latency();
  const db = getDb();
  const live = db.bookings.filter((b) => b.status !== "cancelled" && b.status !== "awaiting_payment");
  const sort = (a: Booking, b: Booking) => a.time_needed.localeCompare(b.time_needed);
  return {
    pickups: live.filter((b) => b.fulfilment === "pickup" && b.start_date === date && b.status !== "no_show").sort(sort).map((b) => staffView(db, b)),
    deliveries: live.filter((b) => b.fulfilment === "delivery" && b.start_date === date && b.status !== "no_show").sort(sort).map((b) => staffView(db, b)),
    returns: live.filter((b) => b.end_date === date && (b.status === "with_tourist" || b.status === "completed")).sort(sort).map((b) => staffView(db, b)),
  };
}

export async function staffSearch(q: string): Promise<StaffBooking[]> {
  requireStaff();
  await latency();
  const db = getDb();
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  return db.bookings
    .filter((b) => b.reference.toLowerCase().includes(s) || b.guest_name.toLowerCase().includes(s))
    .sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 20).map((b) => staffView(db, b));
}

export async function staffGetBooking(id: string): Promise<StaffBooking | null> {
  requireStaff();
  await latency(150);
  const db = getDb();
  const b = db.bookings.find((x) => x.id === id);
  return b ? staffView(db, b) : null;
}

/** verify_pin(booking_id, pin) — counts attempts and locks after 5 (FR-042). */
export async function verifyPin(id: string, pin: string): Promise<{ ok: boolean; attemptsLeft: number; locked: boolean }> {
  requireStaff();
  await latency(400);
  return transaction((db) => {
    const b = db.bookings.find((x) => x.id === id);
    if (!b) throw new ApiError("Booking not found.");
    if (b.is_locked) return { ok: false, attemptsLeft: 0, locked: true };
    if (b.pin === pin) {
      b.pin_verified_at = new Date().toISOString();
      b.pin_attempts = 0;
      audit(db, "pin_verified", "booking", id);
      return { ok: true, attemptsLeft: MAX_PIN_ATTEMPTS, locked: false };
    }
    b.pin_attempts += 1;
    if (b.pin_attempts >= MAX_PIN_ATTEMPTS) {
      b.is_locked = true;
      audit(db, "pin_locked", "booking", id, { attempts: b.pin_attempts });
    }
    return { ok: false, attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - b.pin_attempts), locked: b.is_locked };
  });
}

function snapshotVendor(item: Booking["items"][number], v: Vendor) {
  item.vendor_id = v.id;
  item.commission_type = v.commission_type;
  item.commission_value = v.commission_value;
  item.commission_amount = commissionFor(v.commission_type, v.commission_value, item.line_total, item.days);
}

/** record_handover() — enforces BRL-007 and FR-040. */
export async function recordHandover(id: string, entries: HandoverEntry[], cash: { received: boolean; amount: number } | null): Promise<void> {
  requireStaff();
  await latency(500);
  transaction((db) => {
    const b = db.bookings.find((x) => x.id === id);
    if (!b) throw new ApiError("Booking not found.");
    const blockers = handoverBlockers(b, entries);
    if (blockers.length) throw new ApiError(blockers[0]);
    const conflicts = handoverConflicts(b.id, entries, db.bookings);
    if (conflicts.length) throw new ApiError(conflicts[0]);
    if (b.payment_status === "cash_due" && !cash?.received) throw new ApiError(`Collect the cash (${b.total.toFixed(2)}) before completing the handover.`);
    for (const e of entries) {
      const item = b.items.find((i) => i.id === e.item_id)!;
      if (item.vendor_id !== e.vendor_id) {
        const v = db.vendors.find((x) => x.id === e.vendor_id);
        if (!v) throw new ApiError("Choose a vendor for every bicycle.");
        snapshotVendor(item, v);
      }
      item.bicycle_number = e.bicycle_number.trim().toUpperCase();
    }
    b.status = "with_tourist";
    b.handed_over_at = new Date().toISOString();
    if (b.payment_status === "cash_due" && cash?.received) {
      b.payment_status = "paid";
      b.cash_collected_amount = cash.amount;
      db.payments.push({ id: newId("pay"), booking_id: b.id, amount: cash.amount, method: "cash", status: "succeeded", provider_reference: "cash", created_at: b.handed_over_at });
      sendEmail(db, b, "receipt", receiptEmail(b, db.settings));
      audit(db, "payment", "booking", b.id, { amount: cash.amount, method: "cash" });
    }
    audit(db, "handover", "booking", b.id, { bicycles: b.items.map((i) => i.bicycle_number) });
  });
}

/** record_return() */
export async function recordReturn(id: string, notes: { item_id: string; condition_notes: string }[], returnedAt: string): Promise<void> {
  requireStaff();
  await latency(400);
  transaction((db) => {
    const b = db.bookings.find((x) => x.id === id);
    if (!b) throw new ApiError("Booking not found.");
    if (b.status !== "with_tourist") throw new ApiError("Only bicycles that are out can be returned.");
    notes.forEach((n) => {
      const item = b.items.find((i) => i.id === n.item_id);
      if (item) item.condition_notes = n.condition_notes.trim() || "Good";
    });
    b.status = "completed";
    b.returned_at = returnedAt;
    audit(db, "return", "booking", b.id, { returned_at: returnedAt });
  });
}

// ------------------------------------------------------------------ admin

export async function adminData() {
  requireAdmin();
  await latency();
  return clone(getDb());
}

export async function assignVendor(bookingId: string, itemId: string, vendorId: string): Promise<void> {
  requireAdmin();
  await latency(150);
  transaction((db) => {
    const b = db.bookings.find((x) => x.id === bookingId);
    const item = b?.items.find((i) => i.id === itemId);
    const v = db.vendors.find((x) => x.id === vendorId && x.is_active);
    if (!b || !item || !v) throw new ApiError("Couldn't assign that vendor.");
    if (b.status === "completed" || b.status === "cancelled") throw new ApiError("This booking is closed.");
    snapshotVendor(item, v);
    audit(db, "vendor_assigned", "booking", b.id, { item: itemId, vendor: v.business_name, commission: `${v.commission_type}:${v.commission_value}` });
  });
}

export type AdminAction = "no_show" | "unlock" | "refund";

export async function adminBookingAction(id: string, action: AdminAction | { cancel: string }): Promise<void> {
  requireAdmin();
  await latency(250);
  transaction((db) => {
    const b = db.bookings.find((x) => x.id === id);
    if (!b) throw new ApiError("Booking not found.");
    if (typeof action === "object") {
      if (["completed", "cancelled", "with_tourist"].includes(b.status)) throw new ApiError("This booking can't be cancelled now.");
      b.status = "cancelled";
      b.cancellation_reason = action.cancel.trim() || "Cancelled by the hotel";
      sendEmail(db, b, "cancellation", cancellationEmail(b, db.settings));
      audit(db, "cancellation", "booking", id, { by: "admin", reason: b.cancellation_reason });
    } else if (action === "no_show") {
      if (b.status !== "confirmed") throw new ApiError("Only confirmed bookings can be marked as no-show.");
      b.status = "no_show";
      audit(db, "no_show", "booking", id);
    } else if (action === "unlock") {
      b.is_locked = false;
      b.pin_attempts = 0;
      audit(db, "pin_unlocked", "booking", id);
    } else {
      if (b.payment_status !== "paid") throw new ApiError("Only paid bookings can be refunded.");
      b.payment_status = "refunded";
      db.payments.filter((p) => p.booking_id === id && p.status === "succeeded").forEach((p) => (p.status = "refunded"));
      audit(db, "refund", "booking", id, { amount: b.total });
    }
  });
}

export async function saveInternalNotes(id: string, notes: string): Promise<void> {
  requireAdmin();
  await latency(150);
  transaction((db) => {
    const b = db.bookings.find((x) => x.id === id);
    if (b) b.internal_notes = notes.trim() || null;
  });
}

export type ListingInput = Omit<Listing, "id" | "sort_order"> & { id?: string };

export async function saveListing(input: ListingInput, images: { storage_path: string; is_primary: boolean }[]): Promise<Listing> {
  requireAdmin();
  await latency(350);
  return transaction((db) => {
    if (db.listings.some((l) => l.slug === input.slug && l.id !== input.id)) throw new ApiError("Another bicycle already uses this web address.");
    let listing: Listing;
    if (input.id) {
      listing = db.listings.find((l) => l.id === input.id)!;
      if (listing.daily_price !== input.daily_price) audit(db, "price_changed", "listing", listing.id, { from: listing.daily_price, to: input.daily_price });
      Object.assign(listing, input);
    } else {
      listing = { ...input, id: newId("l"), sort_order: Math.max(0, ...db.listings.map((l) => l.sort_order)) + 1 };
      db.listings.push(listing);
      audit(db, "listing_created", "listing", listing.id, { price: listing.daily_price });
    }
    db.listing_images = db.listing_images.filter((i) => i.listing_id !== listing.id);
    const hasPrimary = images.some((i) => i.is_primary);
    images.forEach((img, i) => db.listing_images.push({ id: newId("img"), listing_id: listing.id, storage_path: img.storage_path, is_primary: hasPrimary ? img.is_primary : i === 0, sort_order: i + 1 }));
    return clone(listing);
  });
}

export async function updateListingFlags(id: string, flags: Partial<Pick<Listing, "is_active" | "is_featured">>): Promise<void> {
  requireAdmin();
  transaction((db) => Object.assign(db.listings.find((l) => l.id === id)!, flags));
}

export async function duplicateListing(id: string): Promise<Listing> {
  requireAdmin();
  await latency(250);
  return transaction((db) => {
    const src = db.listings.find((l) => l.id === id)!;
    let slug = `${src.slug}-copy`;
    for (let n = 2; db.listings.some((l) => l.slug === slug); n++) slug = `${src.slug}-copy-${n}`;
    const copy: Listing = { ...clone(src), id: newId("l"), name: `${src.name} (copy)`, slug, is_active: false, is_featured: false, sort_order: Math.max(...db.listings.map((l) => l.sort_order)) + 1 };
    db.listings.push(copy);
    db.listing_images.filter((i) => i.listing_id === id).forEach((i) => db.listing_images.push({ ...i, id: newId("img"), listing_id: copy.id }));
    return clone(copy);
  });
}

/** Generic admin upsert for simple tables. */
function upsert<K extends "vendors" | "categories" | "discounts" | "pickup_points" | "hotels">(table: K, prefix: string) {
  type Row = Database[K][number];
  return async (input: Omit<Row, "id"> & { id?: string }): Promise<void> => {
    requireAdmin();
    await latency(250);
    transaction((db) => {
      const rows = db[table] as Row[];
      if (input.id) Object.assign(rows.find((r) => r.id === input.id)!, input);
      else rows.push({ ...input, id: newId(prefix) } as Row);
      audit(db, `${table}_saved`, table, input.id ?? "new", {});
    });
  };
}

export const saveVendor = upsert("vendors", "v");
export const saveDiscount = upsert("discounts", "d");
export const savePickupPoint = upsert("pickup_points", "p");
export const saveHotel = upsert("hotels", "h");
const upsertCategory = upsert("categories", "c");
export async function saveCategory(input: Omit<Category, "id" | "sort_order"> & { id?: string }) {
  const db = getDb();
  if (db.categories.some((c) => c.slug === input.slug && c.id !== input.id)) throw new ApiError("Another category already uses this name.");
  const sort_order = input.id ? db.categories.find((c) => c.id === input.id)!.sort_order : Math.max(0, ...db.categories.map((c) => c.sort_order)) + 1;
  return upsertCategory({ ...input, sort_order });
}

export async function moveCategory(id: string, dir: -1 | 1): Promise<void> {
  requireAdmin();
  transaction((db) => {
    const list = [...db.categories].sort(byOrder);
    const i = list.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((c, idx) => (db.categories.find((x) => x.id === c.id)!.sort_order = idx + 1));
  });
}

export async function saveUser(input: { id?: string; name: string; email: string; password?: string; role: Role }): Promise<void> {
  requireAdmin();
  await latency(250);
  transaction((db) => {
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email === email && u.id !== input.id)) throw new ApiError("A user with this email already exists.");
    let user = input.id ? db.users.find((u) => u.id === input.id) : undefined;
    if (user) Object.assign(user, { name: input.name, email, ...(input.password ? { password: input.password } : {}) });
    else {
      if (!input.password) throw new ApiError("Set a temporary password.");
      user = { id: newId("u"), name: input.name, email, password: input.password };
      db.users.push(user);
    }
    if (user.id === currentUser()?.id && input.role !== "admin") throw new ApiError("You can't remove your own admin role.");
    db.user_roles = db.user_roles.filter((r) => r.user_id !== user!.id).concat({ user_id: user.id, role: input.role });
    audit(db, "user_saved", "user", user.id, { role: input.role });
  });
}

export async function saveSettings(s: Settings): Promise<void> {
  requireAdmin();
  await latency(250);
  transaction((db) => {
    if (db.settings.delivery_fee !== s.delivery_fee) audit(db, "price_changed", "settings", "delivery_fee", { from: db.settings.delivery_fee, to: s.delivery_fee });
    db.settings = s;
  });
}

export function resetDemoData() {
  requireAdmin();
  resetDatabase();
}
