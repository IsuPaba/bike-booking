import { describe, expect, it } from "vitest";
import { unitsFree } from "./availability";
import { handoverBlockers, handoverConflicts, guestCancellation } from "./rules";
import type { Booking, Settings } from "./types";

const now = new Date("2026-12-01T06:00:00.000Z"); // 1 Dec 10:00 Seychelles

const booking = (id: string, start: string, end: string, bikes: number, status: Booking["status"] = "confirmed", createdMinAgo = 60) => ({
  id, status, created_at: new Date(now.getTime() - createdMinAgo * 60_000).toISOString(),
  start_date: start, end_date: end, items: Array.from({ length: bikes }, () => ({ listing_id: "l1" })),
});

const listing = { id: "l1", daily_limit: 5 };

describe("unitsFree (BRL-008 daily limit)", () => {
  it("uses the tightest day of the range", () => {
    const bookings = [booking("a", "2026-12-02", "2026-12-04", 2), booking("b", "2026-12-04", "2026-12-06", 2)];
    expect(unitsFree(listing, "2026-12-03", "2026-12-05", bookings, now)).toBe(1); // 4 booked on the 4th
    expect(unitsFree(listing, "2026-12-07", "2026-12-08", bookings, now)).toBe(5);
  });

  it("ignores expired awaiting_payment holds", () => {
    expect(unitsFree(listing, "2026-12-02", "2026-12-02", [booking("a", "2026-12-02", "2026-12-02", 5, "awaiting_payment", 20)], now)).toBe(5);
    expect(unitsFree(listing, "2026-12-02", "2026-12-02", [booking("a", "2026-12-02", "2026-12-02", 5, "awaiting_payment", 5)], now)).toBe(0);
  });

  it("ignores cancelled, completed and no-show bookings", () => {
    const bookings = (["cancelled", "completed", "no_show"] as const).map((s, i) => booking(String(i), "2026-12-02", "2026-12-02", 5, s));
    expect(unitsFree(listing, "2026-12-02", "2026-12-02", bookings, now)).toBe(5);
  });
});

const full = (over: Partial<Booking>): Booking => ({
  id: "b1", reference: "BK-AAAAAA", pin: "1234", pin_attempts: 0, is_locked: false, pin_verified_at: now.toISOString(),
  status: "confirmed", payment_status: "paid", payment_method: "card", guest_name: "G", guest_phone: "1", guest_email: "g@x.test",
  guest_passport: "X1", hotel_id: null, hotel_other_name: null, room: "1", start_date: "2026-12-03", end_date: "2026-12-04",
  fulfilment: "pickup", pickup_point_id: "p1", time_needed: "09:00", subtotal: 0, discount_total: 0, delivery_fee: 0, total: 0,
  cash_collected_amount: null, cancellation_reason: null, internal_notes: null, created_at: now.toISOString(), handed_over_at: null, returned_at: null,
  items: [{ id: "i1", booking_id: "b1", listing_id: "l1", unit_price: 10, days: 2, discount_amount: 0, line_total: 20, price_breakdown: { text: "" },
    vendor_id: null, commission_type: null, commission_value: null, commission_amount: null, bicycle_number: null, condition_notes: null }],
  ...over,
});

describe("handover rules", () => {
  it("needs the PIN and a vendor + number for every bike (BRL-007)", () => {
    expect(handoverBlockers(full({ pin_verified_at: null }), [{ item_id: "i1", vendor_id: "v1", bicycle_number: "101" }])).toContain("Check the guest's PIN first.");
    expect(handoverBlockers(full({}), [])).toContain("Every bicycle needs a vendor and a bicycle number.");
    expect(handoverBlockers(full({}), [{ item_id: "i1", vendor_id: "v1", bicycle_number: "101" }])).toEqual([]);
  });

  it("blocks a bicycle number that is already out with the same vendor (FR-040)", () => {
    const out = full({ id: "b2", reference: "BK-OUT111", status: "with_tourist", items: [{ ...full({}).items[0], id: "i9", vendor_id: "v1", bicycle_number: "101" }] });
    expect(handoverConflicts("b1", [{ item_id: "i1", vendor_id: "v1", bicycle_number: "101" }], [out])[0]).toContain("BK-OUT111");
    expect(handoverConflicts("b1", [{ item_id: "i1", vendor_id: "v2", bicycle_number: "101" }], [out])).toEqual([]);
  });
});

describe("guest cancellation window (Q8)", () => {
  const s = { free_cancellation_hours: 24 } as Settings;
  it("allows cancelling until 24 h before the start", () => {
    expect(guestCancellation(full({ start_date: "2026-12-03" }), s, now).allowed).toBe(true);
    expect(guestCancellation(full({ start_date: "2026-12-01", time_needed: "18:00" }), s, now).allowed).toBe(false);
  });
});
