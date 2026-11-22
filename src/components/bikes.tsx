import { ArrowUpRight, CalendarDays, Search, Zap } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatMoney } from "@/lib/money";
import { priceOnDay } from "@/lib/pricing";
import { validateDates } from "@/lib/rules";
import { TZ_LABEL, scDate } from "@/lib/time";
import type { Category, Discount, Listing } from "@/lib/types";
import { Badge, Button, Skeleton, buttonClass } from "./ui";

export function AvailabilityChip({ free }: { free: number }) {
  if (free <= 0) return <Badge tone="booked">Not available for these dates</Badge>;
  if (free <= 2) return <Badge tone="low">Only {free} left</Badge>;
  return <Badge tone="available">{free} available</Badge>;
}

export function TypeChip({ listing }: { listing: Pick<Listing, "bike_type"> }) {
  return listing.bike_type === "electric" ? <Badge tone="ride"><Zap size={12} aria-hidden /> Electric</Badge> : <Badge tone="outline">Standard</Badge>;
}

export function ImageBox({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden bg-tint ${className}`}>
      {src ? <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-[1.03]" />
        : <div className="grid h-full place-items-center text-ink-soft">No photo yet</div>}
    </div>
  );
}

/** Daily price with the original crossed out when a discount applies (FR-011). */
export function DailyPrice({ listing, discounts, day, large = false }: { listing: Listing; discounts: Discount[]; day?: string; large?: boolean }) {
  const p = priceOnDay(listing, day ?? scDate(new Date()), discounts);
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className={large ? "text-3xl font-bold" : "text-2xl font-bold"}>{formatMoney(p.price)}</span>
        {p.discount && <s className="text-ink-soft">{formatMoney(p.original)}</s>}
        <span className="text-sm text-ink-soft">/ day</span>
      </p>
      {p.discount && <p className="text-sm font-medium text-status-available">{p.discount.name} applied</p>}
    </div>
  );
}

export function ListingCard({ listing, category, image, discounts, free, day, linkSearch = "" }: {
  listing: Listing; category?: Category; image: string | null; discounts: Discount[]; free?: number; day?: string; linkSearch?: string;
}) {
  const href = `/bicycles/${listing.slug}${linkSearch}`;
  return (
    <article className="card group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:shadow-lift">
      <Link to={href} className="relative block" tabIndex={-1} aria-hidden>
        <ImageBox src={image} alt="" className="aspect-[3/2]" />
        {listing.is_featured && <span className="absolute left-4 top-4"><Badge tone="primary">Island favourite</Badge></span>}
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-2">
          {category && <p className="eyebrow">{category.name}</p>}
          <TypeChip listing={listing} />
        </div>
        <h3 className="mt-2 text-xl font-medium"><Link to={href} className="hover:text-primary">{listing.name}</Link></h3>
        <p className="mt-2 text-ink-soft">{listing.short_description}</p>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Features">
          {listing.features.slice(0, 3).map((f) => <li key={f} className="rounded-md bg-tint px-2.5 py-1 text-xs font-medium text-ink">{f}</li>)}
        </ul>
        {free !== undefined && <div className="mt-4"><AvailabilityChip free={free} /></div>}
        <div className="min-h-5 flex-1" />
        <div className="flex items-end justify-between gap-3 border-t border-line pt-5">
          <DailyPrice listing={listing} discounts={discounts} day={day} />
          <Link to={href} className={buttonClass("outline", "md")} aria-label={`View ${listing.name}`}>View <ArrowUpRight size={16} /></Link>
        </div>
      </div>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden>
      <Skeleton className="aspect-[3/2] rounded-none" />
      <div className="space-y-3 p-6">
        <Skeleton className="h-3 w-24" /><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-full" />
        <div className="flex gap-2"><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-16" /></div>
        <Skeleton className="mt-4 h-10 w-full" />
      </div>
    </div>
  );
}

export function DateInput({ id, label, value, onChange, min, error }: { id: string; label: string; value: string; onChange: (v: string) => void; min?: string; error?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink-soft"><CalendarDays size={15} aria-hidden /> {label}</label>
      <input id={id} type="date" min={min} value={value} onChange={(e) => onChange(e.target.value)} className="field" aria-invalid={!!error} />
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

/** Home page date search → /bicycles?start=…&end=…&qty=… */
export function DateSearch({ defaultStart, defaultEnd }: { defaultStart: string; defaultEnd: string }) {
  const navigate = useNavigate();
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const today = scDate(new Date());

  function submit(e: FormEvent) {
    e.preventDefault();
    const err = validateDates(start, end);
    setError(err);
    if (!err) navigate(`/bicycles?${new URLSearchParams({ start, end, qty: String(qty) })}`);
  }

  return (
    <div>
      <form onSubmit={submit} className="card grid gap-4 p-5 shadow-lift sm:p-6 md:grid-cols-[1fr_1fr_160px_auto] md:items-end" aria-label="Search bicycles">
        <DateInput id="qs-start" label="Start date" value={start} min={today} onChange={(v) => { setStart(v); if (end < v) setEnd(v); }} />
        <DateInput id="qs-end" label="End date" value={end} min={start} onChange={setEnd} />
        <div>
          <label htmlFor="qs-qty" className="mb-1.5 block text-sm font-semibold text-ink-soft">Bicycles</label>
          <select id="qs-qty" className="field" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? "bicycle" : "bicycles"}</option>)}
          </select>
        </div>
        <Button type="submit" size="lg" className="w-full md:w-auto"><Search size={18} /> Find bicycles</Button>
        {error && <p className="field-error md:col-span-4" role="alert">{error}</p>}
      </form>
      <p className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-ink-soft">
        <span className="font-semibold text-ink">Priced per day — collect any time on your first day.</span>
        <span>Dates in {TZ_LABEL} (UTC+4)</span>
      </p>
    </div>
  );
}
