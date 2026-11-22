import clsx from "clsx";
import { AlertTriangle, ChevronRight, Lock, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PaymentBadge, StatusBadge } from "@/components/booking";
import { EmptyState, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { staffDay, staffLookups, staffSearch, type StaffBooking } from "@/lib/api";
import { bikesSummary } from "@/lib/emails";
import { addDays, formatDate, scDate } from "@/lib/time";

type Tab = "pickups" | "deliveries" | "returns";

function BookingCard({ b, listings, mode }: { b: StaffBooking; listings: { id: string; name: string }[]; mode: Tab | "search" }) {
  const returning = mode === "returns" || (mode === "search" && b.status === "with_tourist");
  const href = returning && b.status === "with_tourist" ? `/staff/booking/${b.id}/return` : `/staff/booking/${b.id}`;
  const unassigned = b.items.some((i) => !i.vendor_id);
  return (
    <Link to={href} className="card flex items-center gap-4 p-4 transition active:scale-[.99]">
      <div className="w-16 shrink-0 text-center">
        <p className="text-2xl font-bold tabular-nums">{mode === "returns" ? "—" : b.time_needed}</p>
        <p className="text-xs text-ink-soft">{mode === "search" ? formatDate(b.start_date).replace(/ \d{4}$/, "") : mode === "returns" ? "return" : b.fulfilment}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold">{b.guest_name}</p>
        <p className="truncate text-sm text-ink-soft">{b.fulfilment === "delivery" ? `${b.hotel_name} · room ${b.room}` : `${b.pickup_point_name} · ${b.hotel_name ?? ""} ${b.room}`}</p>
        <p className="text-sm">{bikesSummary(b, listings)}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <StatusBadge status={b.status} />
          <PaymentBadge booking={b} />
          {b.is_locked && <span className="inline-flex items-center gap-1 rounded-md bg-status-overdue-bg px-2 py-0.5 text-xs font-semibold text-status-overdue"><Lock size={12} /> PIN locked</span>}
          {unassigned && b.status === "confirmed" && <span className="inline-flex items-center gap-1 rounded-md bg-status-low-bg px-2 py-0.5 text-xs font-semibold text-status-low"><AlertTriangle size={12} /> Vendor not assigned</span>}
        </div>
      </div>
      <ChevronRight className="shrink-0 text-ink-soft" aria-hidden />
    </Link>
  );
}

export default function StaffToday() {
  const today = scDate(new Date());
  const [date, setDate] = useState(today);
  const [tab, setTab] = useState<Tab>("pickups");
  const [query, setQuery] = useState("");
  const { data, loading } = useData(async () => ({ day: await staffDay(date), lookups: await staffLookups() }), [date]);
  const { data: results } = useData(() => staffSearch(query), [query]);
  const list = data?.day[tab] ?? [];

  return (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" size={20} aria-hidden />
        <input className="field h-14 pl-12 text-lg" placeholder="Search reference or guest name" aria-label="Search bookings" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {query.trim().length >= 2 ? (
        <section className="mt-5 space-y-3" aria-label="Search results">
          {(results ?? []).length === 0 ? <EmptyState title="No bookings found">Try the booking reference (BK-…) or the guest's surname.</EmptyState>
            : results!.map((b) => <BookingCard key={b.id} b={b} listings={data?.lookups.listings ?? []} mode="search" />)}
        </section>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between gap-3">
            <h1 className="h-display text-4xl">{date === today ? "Today" : formatDate(date)}</h1>
            <div className="flex gap-1">
              <button className="h-11 rounded-xl px-3 font-semibold ring-1 ring-line" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
              {date !== today && <button className="h-11 rounded-xl px-3 text-sm font-semibold ring-1 ring-line" onClick={() => setDate(today)}>Today</button>}
              <button className="h-11 rounded-xl px-3 font-semibold ring-1 ring-line" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
            </div>
          </div>
          <div role="tablist" className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
            {(["pickups", "deliveries", "returns"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={clsx("h-12 rounded-xl text-base font-semibold capitalize", tab === t ? "bg-primary text-primary-ink" : "text-ink-soft")}>
                {t} {data && <span className="tabular-nums">({data.day[t].length})</span>}
              </button>
            ))}
          </div>
          <section className="mt-4 space-y-3" aria-live="polite">
            {loading || !data ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
              : list.length === 0 ? <EmptyState title={`No ${tab} ${date === today ? "today" : "on this day"}`}>Use the arrows to check another day.</EmptyState>
              : list.map((b) => <BookingCard key={b.id} b={b} listings={data.lookups.listings} mode={tab} />)}
          </section>
        </>
      )}
    </>
  );
}
