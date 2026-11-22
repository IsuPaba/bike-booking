import { describe, expect, it } from "vitest";
import { bestDiscountForDay, commissionFor, daysCharged, priceLine, quoteCart } from "./pricing";
import type { Discount } from "./types";

const city = { id: "l1", category_id: "c-women", daily_price: 12, name: "Women's city bike" };
const ebike = { id: "l2", category_id: "c-electric", daily_price: 35, name: "E-bike" };

const discount = (d: Partial<Discount>): Discount => ({
  id: d.id ?? "d", name: "Festive", discount_type: "percentage", value: 15, starts_on: "2026-12-01", ends_on: "2026-12-31",
  scope: "all", category_ids: [], listing_ids: [], is_active: true, ...d,
});

describe("daysCharged (BRL-001: per calendar day)", () => {
  it("charges a same-day rental as 1 day", () => expect(daysCharged("2026-12-05", "2026-12-05")).toBe(1));
  it("charges 1 night as 2 days", () => expect(daysCharged("2026-12-05", "2026-12-06")).toBe(2));
  it("charges a 7-day rental as 7 days", () => expect(daysCharged("2026-12-01", "2026-12-07")).toBe(7));
});

describe("discounts", () => {
  it("only discounts days inside the date range (BRL-005)", () => {
    const q = priceLine(city, 1, "2026-11-29", "2026-12-02", [discount({})]); // 4 days, 2 in December
    expect(q.gross).toBe(48);
    expect(q.discount_amount).toBe(3.6); // 15% of 12 × 2 days
    expect(q.line_total).toBe(44.4);
  });

  it("picks the single best discount per bike per day, never stacking (BRL-004)", () => {
    const pct = discount({ id: "a", name: "Festive", value: 15 });
    const fixed = discount({ id: "b", name: "Electric", discount_type: "fixed_per_day", value: 3, scope: "categories", category_ids: ["c-electric"] });
    expect(bestDiscountForDay(ebike, "2026-12-10", [pct, fixed])?.discount.id).toBe("a"); // 5.25 > 3
    expect(bestDiscountForDay(city, "2026-12-10", [fixed])).toBeNull(); // wrong category
    const q = priceLine(ebike, 1, "2026-12-10", "2026-12-10", [pct, fixed]);
    expect(q.discount_amount).toBe(5.25);
  });

  it("caps a fixed discount at the daily price", () => {
    const big = discount({ discount_type: "fixed_per_day", value: 50 });
    expect(priceLine(city, 1, "2026-12-10", "2026-12-10", [big]).line_total).toBe(0);
  });

  it("produces the readable breakdown", () => {
    const q = priceLine(city, 2, "2026-11-30", "2026-12-02", [discount({})]);
    expect(q.breakdown).toBe("2 × Women's city bike × 3 days × $12 = $72 · Festive −15% on 2 days = −$7.20");
  });
});

describe("quoteCart", () => {
  it("adds multiple bikes and the delivery fee", () => {
    const q = quoteCart([{ listing: city, quantity: 2 }, { listing: ebike, quantity: 1 }], "2026-11-10", "2026-11-11", [], "delivery", 5);
    expect(q.subtotal).toBe(2 * 2 * 12 + 2 * 35);
    expect(q.delivery_fee).toBe(5);
    expect(q.total).toBe(123);
    expect(q.bicycles).toBe(3);
  });

  it("charges no delivery fee for self-pickup", () => {
    expect(quoteCart([{ listing: city, quantity: 1 }], "2026-11-10", "2026-11-10", [], "pickup", 5).total).toBe(12);
  });
});

describe("commissionFor", () => {
  it("supports percentage and fixed per bike-day", () => {
    expect(commissionFor("percentage", 15, 36, 3)).toBe(5.4);
    expect(commissionFor("fixed_per_bike_day", 2, 36, 3)).toBe(6);
  });
});
