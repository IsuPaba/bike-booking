import clsx from "clsx";
import { Check, KeyRound, MapPin, Truck, X } from "lucide-react";
import { bikesSummary } from "@/lib/emails";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { Booking, Hotel, Listing, PickupPoint, Settings } from "@/lib/types";
import { DirectionsButton, MapView } from "./MapView";
import { Badge } from "./ui";

export const STATUS_LABEL: Record<Booking["status"], string> = {
  awaiting_payment: "Awaiting payment", confirmed: "Confirmed", with_tourist: "With guest", completed: "Returned", cancelled: "Cancelled", no_show: "No-show",
};
export const PAYMENT_LABEL: Record<Booking["payment_status"], string> = { unpaid: "Unpaid", paid: "Paid", cash_due: "Cash due", refunded: "Refunded" };
export const METHOD_LABEL: Record<Booking["payment_method"], string> = { card: "Card", google_pay: "Google Pay", cash: "Cash" };

export function StatusBadge({ status }: { status: Booking["status"] }) {
  const tone = ({ awaiting_payment: "low", confirmed: "available", with_tourist: "primary", completed: "booked", cancelled: "overdue", no_show: "overdue" } as const)[status];
  return <Badge tone={tone}>{STATUS_LABEL[status]}</Badge>;
}

export function PaymentBadge({ booking }: { booking: Pick<Booking, "payment_status" | "total"> }) {
  const tone = ({ unpaid: "low", paid: "available", cash_due: "low", refunded: "booked" } as const)[booking.payment_status];
  return <Badge tone={tone}>{booking.payment_status === "cash_due" ? `Cash due ${formatMoney(booking.total)}` : PAYMENT_LABEL[booking.payment_status]}</Badge>;
}

/** Confirmed → With you → Returned (or Cancelled / No-show). */
export function StatusTimeline({ booking }: { booking: Booking }) {
  const steps = [
    { label: "Confirmed", done: booking.status !== "awaiting_payment" },
    { label: "With you", done: booking.status === "with_tourist" || booking.status === "completed" },
    { label: "Returned", done: booking.status === "completed" },
  ];
  const ended = booking.status === "cancelled" || booking.status === "no_show";
  return (
    <ol className="flex flex-col gap-4 sm:flex-row sm:gap-0" aria-label="Booking progress">
      {steps.map((s, i) => (
        <li key={s.label} className="flex flex-1 items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
          <div className="flex w-full items-center">
            <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold", s.done ? "bg-status-available text-white" : "bg-line text-ink-soft")} aria-hidden>{s.done ? <Check size={16} /> : i + 1}</span>
            {i < steps.length - 1 && <span className={clsx("mx-2 hidden h-0.5 flex-1 rounded sm:block", steps[i + 1].done ? "bg-status-available" : "bg-line")} />}
          </div>
          <span className={clsx("text-sm font-semibold", s.done ? "text-ink" : "text-ink-soft")}>{s.label}<span className="sr-only">{s.done ? " (done)" : " (not yet)"}</span></span>
        </li>
      ))}
      {ended && (
        <li className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-status-overdue text-white" aria-hidden><X size={16} /></span>
          <span className="text-sm font-semibold text-status-overdue">{STATUS_LABEL[booking.status]}</span>
        </li>
      )}
    </ol>
  );
}

export function PinCard({ pin }: { pin: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-primary bg-tint/50 p-5 text-center">
      <p className="flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary"><KeyRound size={16} aria-hidden /> Your PIN</p>
      <p className="mt-1 font-mono text-5xl font-bold tracking-[0.35em] text-ink" aria-label={`PIN ${pin.split("").join(" ")}`}>{pin}</p>
      <p className="mt-2 text-sm text-ink-soft">Show this PIN when you collect your bicycles.</p>
    </div>
  );
}

/** Where and when: pickup point with map + directions, or delivery hotel + time. */
export function Fulfilment({ booking, pickups, hotels, settings, showMap = true }: { booking: Booking; pickups: PickupPoint[]; hotels: Hotel[]; settings: Settings; showMap?: boolean }) {
  if (booking.fulfilment === "pickup") {
    const p = pickups.find((x) => x.id === booking.pickup_point_id);
    if (!p) return null;
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden />
          <span><b>Self-pickup at {p.name}</b> · {formatDate(booking.start_date)} at {booking.time_needed}<br /><span className="text-sm text-ink-soft">{p.address} · open {p.opens_at}–{p.closes_at}. {p.instructions}</span></span></p>
        {showMap && <MapView lat={p.latitude} lng={p.longitude} label={p.name} />}
        <DirectionsButton lat={p.latitude} lng={p.longitude} />
      </div>
    );
  }
  const hotel = booking.hotel_id ? hotels.find((h) => h.id === booking.hotel_id)?.name : booking.hotel_other_name;
  return (
    <p className="flex items-start gap-2"><Truck className="mt-0.5 shrink-0 text-primary" size={18} aria-hidden />
      <span><b>Delivery to {hotel}</b>, room {booking.room} · {formatDate(booking.start_date)} at {booking.time_needed}<br />
        <span className="text-sm text-ink-soft">Return the bicycles at your hotel reception by {settings.return_time} on {formatDate(booking.end_date)}.</span></span></p>
  );
}

export function BookingFacts({ booking, listings, settings }: { booking: Booking; listings: Pick<Listing, "id" | "name">[]; settings: Settings }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><dt className="text-sm text-ink-soft">Bicycles</dt><dd className="font-semibold">{bikesSummary(booking, listings)}</dd></div>
      <div><dt className="text-sm text-ink-soft">Dates</dt><dd className="font-semibold">{formatDate(booking.start_date)} – {formatDate(booking.end_date)}</dd></div>
      <div><dt className="text-sm text-ink-soft">Return by</dt><dd className="font-semibold">{settings.return_time} on {formatDate(booking.end_date)}</dd></div>
      <div className="rounded-xl bg-tint/50 p-4 sm:col-span-2">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(booking.subtotal)}</span></div>
          {booking.discount_total > 0 && <div className="flex justify-between text-status-available"><span>Discounts</span><span>−{formatMoney(booking.discount_total)}</span></div>}
          {booking.delivery_fee > 0 && <div className="flex justify-between"><span>Delivery</span><span>{formatMoney(booking.delivery_fee)}</span></div>}
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
          <span className="font-semibold">{booking.payment_status === "cash_due" ? "Cash due at handover" : booking.payment_status === "paid" ? `Paid (${METHOD_LABEL[booking.payment_method]})` : "Total"}</span>
          <span className="text-2xl font-bold">{formatMoney(booking.total)}</span>
        </div>
      </div>
    </dl>
  );
}
