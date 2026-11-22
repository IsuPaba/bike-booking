import { zodResolver } from "@hookform/resolvers/zod";
import { FlaskConical, Search, XCircle } from "lucide-react";
import { useData } from "@/hooks/useData";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { BookingFacts, Fulfilment, PinCard, StatusBadge, StatusTimeline } from "@/components/booking";
import { Alert, Button, ConfirmDialog, Field, PageHeading } from "@/components/ui";
import { ApiError, cancelBookingByGuest, getBookingByReference, listDemoBookings, getSettings, listHotels, listListings, listPickupPoints } from "@/lib/api";
import { guestCancellation } from "@/lib/rules";
import type { Booking, Hotel, Listing, PickupPoint, Settings } from "@/lib/types";

const schema = z.object({
  reference: z.string().trim().regex(/^BK-?[A-Za-z0-9]{6}$/i, "References look like BK-7K3F9Q."),
  email: z.string().trim().email("Please enter the email you booked with."),
});
type Values = z.infer<typeof schema>;
type Found = { booking: Booking; email: string; listings: Listing[]; settings: Settings; pickups: PickupPoint[]; hotels: Hotel[] };

export default function MyBooking() {
  const [params] = useSearchParams();
  const [found, setFound] = useState<Found | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: demos } = useData(listDemoBookings);
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reference: params.get("ref") ?? "", email: "" } });

  async function onSubmit(v: Values) {
    setNotFound(false);
    const ref = v.reference.toUpperCase().replace(/^BK-?/, "BK-");
    const [booking, listings, settings, pickups, hotels] = await Promise.all([getBookingByReference(ref, v.email), listListings(), getSettings(), listPickupPoints(), listHotels()]);
    if (!booking) { setFound(null); setNotFound(true); }
    else setFound({ booking, email: v.email, listings, settings, pickups, hotels });
  }

  async function cancel() {
    if (!found) return;
    setBusy(true);
    setError(null);
    try {
      const booking = await cancelBookingByGuest(found.booking.reference, found.email);
      setFound({ ...found, booking });
      setConfirm(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const b = found?.booking;
  const policy = found && b ? guestCancellation(b, found.settings) : null;

  return (
    <div className="container-page max-w-3xl py-14">
      <PageHeading center eyebrow="Your adventure, all in one place" title="Find my booking">See your PIN and details, or cancel your booking.</PageHeading>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="card space-y-5 p-6 sm:p-8">
        <Field label="Booking reference" htmlFor="ref" error={errors.reference?.message}><input id="ref" className="field font-mono uppercase placeholder:font-sans" placeholder="BK-XXXXXX" autoComplete="off" {...register("reference")} aria-invalid={!!errors.reference} /></Field>
        <Field label="Email address" htmlFor="email" error={errors.email?.message}><input id="email" type="email" className="field" placeholder="you@example.com" autoComplete="email" {...register("email")} aria-invalid={!!errors.email} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}><Search size={18} /> Find my booking</Button>
        {notFound && <Alert>We couldn't find a booking with that reference and email. Please check both and try again.</Alert>}
      </form>

      {demos && demos.length > 0 && (
        <section className="mt-6 rounded-2xl border-2 border-dashed border-line p-5" aria-label="Demo bookings">
          <p className="flex items-center gap-2 font-semibold"><FlaskConical size={17} className="text-primary" aria-hidden /> Prototype: try a demo booking</p>
          <p className="mt-1 text-sm text-ink-soft">Click one to fill in the form. The PIN is what the guest shows the staff at handover.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {demos.map((d) => (
              <li key={d.reference}>
                <button type="button" className="w-full rounded-xl bg-surface p-3 text-left ring-1 ring-line transition hover:ring-primary"
                  onClick={() => { setValue("reference", d.reference); setValue("email", d.email); handleSubmit(onSubmit)(); }}>
                  <span className="font-mono font-semibold">{d.reference}</span> <span className="text-sm text-ink-soft">· PIN {d.pin}</span>
                  <span className="block text-sm">{d.email}</span>
                  <span className="block text-xs text-ink-soft">{d.what}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {found && b && (
        <section className="card mt-8 space-y-6 p-6 sm:p-8" aria-label="Your booking">
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-mono text-2xl font-bold">{b.reference}</p><StatusBadge status={b.status} /></div>
          <StatusTimeline booking={b} />
          {(b.status === "confirmed" || b.status === "awaiting_payment") && <PinCard pin={b.pin} />}
          <BookingFacts booking={b} listings={found.listings} settings={found.settings} />
          <Fulfilment booking={b} pickups={found.pickups} hotels={found.hotels} settings={found.settings} showMap={false} />
          <div className="border-t border-line pt-6">
            {b.status === "cancelled" ? <Alert tone="available">This booking is cancelled. We've emailed you a confirmation.</Alert>
              : policy?.allowed ? (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" className="text-status-overdue" onClick={() => setConfirm(true)}><XCircle size={17} /> Cancel booking</Button>
                  <span className="text-sm text-ink-soft">{policy.reason}</span>
                </div>
              ) : <p className="text-sm text-ink-soft">{policy?.reason}</p>}
          </div>
        </section>
      )}
      <ConfirmDialog open={confirm} onCancel={() => setConfirm(false)} onConfirm={cancel} loading={busy} danger title="Cancel this booking?" confirmLabel="Cancel booking"
        message={<>Your bicycles will be released and any online payment refunded. This can't be undone.{error && <Alert className="mt-3">{error}</Alert>}</>} />
    </div>
  );
}
