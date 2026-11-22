import { CalendarPlus, CheckCircle2, Copy, Printer } from "lucide-react";
import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { BookingFacts, Fulfilment, PinCard } from "@/components/booking";
import { Button, ButtonLink, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { getBookingByReference, getSettings, listHotels, listListings, listPickupPoints } from "@/lib/api";
import { bikesSummary, whereText } from "@/lib/emails";
import { recentBookingEmail } from "@/lib/guest";
import { bookingIcs, downloadFile } from "@/lib/ics";

export default function Confirmation() {
  const { reference = "" } = useParams();
  const email = recentBookingEmail(reference);
  const [copied, setCopied] = useState(false);
  const { data, loading } = useData(async () => {
    if (!email) return null;
    const [booking, listings, settings, pickups, hotels] = await Promise.all([getBookingByReference(reference, email), listListings(), getSettings(), listPickupPoints(), listHotels()]);
    return { booking, listings, settings, pickups, hotels };
  }, [reference]);

  // Only the browser that booked opens this directly; anyone else looks it up with reference + email
  if (!email) return <Navigate to={`/my-booking?ref=${encodeURIComponent(reference)}`} replace />;
  if (loading || !data) return <div className="container-page max-w-3xl py-14"><Skeleton className="h-[560px] rounded-2xl" /></div>;
  const { booking, listings, settings, pickups, hotels } = data;
  if (!booking) return <Navigate to="/my-booking" replace />;
  if (booking.status === "awaiting_payment") return <Navigate to={`/pay/${reference}`} replace />;

  return (
    <div className="container-page max-w-3xl py-12">
      <div className="text-center">
        <CheckCircle2 size={64} className="mx-auto text-status-available" aria-hidden />
        <h1 className="h-display mt-4 text-5xl text-status-available sm:text-6xl">You're all set!</h1>
        <p className="mt-2 text-lg text-ink-soft">{booking.payment_status === "cash_due" ? "Your booking is confirmed. Pay in cash at handover." : "Your booking is confirmed and paid."} We've emailed your confirmation.</p>
      </div>
      <div className="card mt-8 overflow-hidden">
        <div className="flex flex-col items-center gap-1 border-b border-line bg-status-available-bg px-6 py-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-status-available">Booking reference</p>
          <div className="flex items-center gap-3">
            <p className="font-mono text-4xl font-bold tracking-wider text-ink sm:text-5xl">{booking.reference}</p>
            <button onClick={async () => { try { await navigator.clipboard.writeText(booking.reference); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* visible to copy by hand */ } }}
              className="no-print grid h-10 w-10 place-items-center rounded-full bg-surface shadow-soft hover:bg-tint" aria-label="Copy booking reference"><Copy size={18} /></button>
          </div>
          <p className="h-5 text-sm text-status-available" aria-live="polite">{copied ? "Copied!" : ""}</p>
        </div>
        <div className="space-y-6 p-6 sm:p-8">
          <PinCard pin={booking.pin} />
          <BookingFacts booking={booking} listings={listings} settings={settings} />
          <Fulfilment booking={booking} pickups={pickups} hotels={hotels} settings={settings} />
        </div>
      </div>
      <div className="no-print mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="primary" onClick={() => downloadFile(`booking-${booking.reference}.ics`, bookingIcs(booking, settings, bikesSummary(booking, listings), whereText(booking, pickups, hotels)))}><CalendarPlus size={18} /> Add to calendar</Button>
        <Button variant="outline" onClick={() => window.print()}><Printer size={18} /> Print / save as PDF</Button>
        <ButtonLink to="/" variant="ghost">Back to home</ButtonLink>
      </div>
    </div>
  );
}
