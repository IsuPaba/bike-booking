/** Simulated emails (stored in email_outbox, never sent). Plain inline-styled HTML. */
import { formatMoney } from "./money";
import { formatDate } from "./time";
import type { Booking, Hotel, Listing, PickupPoint, Settings } from "./types";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const wrap = (s: Settings, title: string, body: string) =>
  `<div style="font-family:Inter,Arial,sans-serif;color:#1f2a30;max-width:560px">` +
  `<p style="font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:12px">${esc(s.brand_name)}</p>` +
  `<h2 style="margin:4px 0 12px">${esc(title)}</h2>${body}` +
  `<p style="color:#667;font-size:12px;margin-top:24px">Questions? ${esc(s.contact_phone)} · ${esc(s.email)}<br>Prototype: this email was not really sent.</p></div>`;

export function bikesSummary(b: Booking, listings: Pick<Listing, "id" | "name">[]): string {
  const counts = new Map<string, number>();
  b.items.forEach((i) => counts.set(i.listing_id, (counts.get(i.listing_id) ?? 0) + 1));
  return [...counts].map(([id, n]) => `${n} × ${listings.find((l) => l.id === id)?.name ?? "Bicycle"}`).join(", ");
}

export function whereText(b: Booking, pickups: PickupPoint[], hotels: Hotel[]): string {
  if (b.fulfilment === "pickup") {
    const p = pickups.find((x) => x.id === b.pickup_point_id);
    return `Self-pickup at ${p?.name ?? "the pickup point"}, ${b.time_needed}`;
  }
  const hotel = b.hotel_id ? hotels.find((h) => h.id === b.hotel_id)?.name : b.hotel_other_name;
  return `Delivery to ${hotel ?? "your hotel"} (room ${b.room}), ${b.time_needed}`;
}

export function confirmationEmail(b: Booking, s: Settings, listings: Listing[], pickups: PickupPoint[], hotels: Hotel[]) {
  const money = b.payment_status === "cash_due" ? `Cash due at handover: <b>${formatMoney(b.total)}</b>` : `Total: <b>${formatMoney(b.total)}</b>`;
  return {
    subject: `Booking confirmed · ${b.reference}`,
    body_html: wrap(s, "Your bicycles are booked", `
<p>Hi ${esc(b.guest_name.split(" ")[0])}, thanks for booking with us.</p>
<p style="font-size:18px">Reference <b>${b.reference}</b> · PIN <b style="letter-spacing:.2em">${b.pin}</b></p>
<p>Show this PIN when you collect your bicycles.</p>
<p>${esc(bikesSummary(b, listings))}<br>${formatDate(b.start_date)} – ${formatDate(b.end_date)} · Return by ${s.return_time} on ${formatDate(b.end_date)}<br>${esc(whereText(b, pickups, hotels))}</p>
<p>${money}</p>`),
  };
}

export function receiptEmail(b: Booking, s: Settings) {
  const how = b.payment_method === "cash" ? "cash at handover" : b.payment_method === "google_pay" ? "Google Pay" : "card";
  return {
    subject: `Receipt · ${b.reference}`,
    body_html: wrap(s, "Payment received", `<p>We received <b>${formatMoney(b.payment_method === "cash" ? b.cash_collected_amount ?? b.total : b.total)}</b> by ${how} for booking <b>${b.reference}</b>.</p>
<p>Subtotal ${formatMoney(b.subtotal)} · Discounts −${formatMoney(b.discount_total)}${b.delivery_fee ? ` · Delivery ${formatMoney(b.delivery_fee)}` : ""}</p>`),
  };
}

export function cancellationEmail(b: Booking, s: Settings) {
  const refund = b.payment_status === "refunded" || b.payment_status === "paid" ? "<p>Any payment will be refunded to the original payment method.</p>" : "";
  return {
    subject: `Booking cancelled · ${b.reference}`,
    body_html: wrap(s, "Your booking is cancelled", `<p>Booking <b>${b.reference}</b> (${formatDate(b.start_date)} – ${formatDate(b.end_date)}) has been cancelled.${b.cancellation_reason ? ` Reason: ${esc(b.cancellation_reason)}.` : ""}</p>${refund}`),
  };
}
