import { ArrowLeft, Check, ChevronLeft, ChevronRight, Ruler, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AvailabilityChip, DailyPrice, DateInput, TypeChip } from "@/components/bikes";
import { Alert, Button, Sheet, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { getListingBySlug, listCategories, listListingImages, listPublicDiscounts, listingAvailability } from "@/lib/api";
import { cart, useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { priceLine } from "@/lib/pricing";
import { validateDates } from "@/lib/rules";
import { TZ_LABEL, scDate } from "@/lib/time";
import type { Discount, Listing, ListingImage } from "@/lib/types";
import NotFound from "./NotFound";

function Gallery({ images, name }: { images: ListingImage[]; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const go = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: ((i + images.length) % images.length) * el.clientWidth, behavior: "smooth" });
  };
  if (!images.length) return <div className="grid aspect-[4/3] place-items-center rounded-3xl bg-tint text-ink-soft">No photos yet</div>;
  return (
    <div className="relative">
      <div ref={ref} onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto rounded-3xl bg-tint [scrollbar-width:none]" aria-roledescription="carousel" aria-label={`${name} photos`}>
        {images.map((img, i) => (
          <img key={img.id} src={img.storage_path} alt={`${name}, photo ${i + 1} of ${images.length}`}
            className={`h-full w-full shrink-0 snap-center ${img.storage_path.includes("hero") ? "object-cover" : "object-contain mix-blend-multiply"}`} />
        ))}
      </div>
      {images.length > 1 && (
        <>
          <button onClick={() => go(index - 1)} className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-surface/90 shadow-soft" aria-label="Previous photo"><ChevronLeft /></button>
          <button onClick={() => go(index + 1)} className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-surface/90 shadow-soft" aria-label="Next photo"><ChevronRight /></button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {images.map((img, i) => <button key={img.id} onClick={() => go(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index} className={`h-2.5 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-2.5 bg-surface/90"}`} />)}
          </div>
        </>
      )}
    </div>
  );
}

function BookingPanel({ listing, discounts, start, end, qty, onChange, onAdded }: {
  listing: Listing; discounts: Discount[]; start: string; end: string; qty: number;
  onChange: (p: { start?: string; end?: string; qty?: number }) => void; onAdded: () => void;
}) {
  const c = useCart();
  const inCart = c.lines.find((l) => l.listing_id === listing.id)?.quantity ?? 0;
  const dateError = validateDates(start, end);
  const [free, setFree] = useState<number | null>(null);
  const cartDatesDiffer = c.lines.length > 0 && (c.start_date !== start || c.end_date !== end);

  useEffect(() => {
    if (dateError) return setFree(null);
    let live = true;
    setFree(null);
    listingAvailability(listing.id, start, end).then((n) => live && setFree(n));
    return () => {
      live = false;
    };
  }, [listing.id, start, end, dateError]);

  const q = useMemo(() => (dateError ? null : priceLine(listing, qty, start, end, discounts)), [listing, qty, start, end, discounts, dateError]);
  const qtyError = free !== null && qty + inCart > free ? (free === 0 ? "None left for these dates. Try other dates." : `Only ${free} available for these dates${inCart ? ` (${inCart} already in your cart)` : ""}.`) : null;

  return (
    <div>
      <h2 className="h-display text-4xl">Add to your ride</h2>
      <p className="mb-4 text-sm text-ink-soft">Dates in {TZ_LABEL} · priced per calendar day</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <DateInput id="bp-start" label="Start date" value={start} min={scDate(new Date())} onChange={(v) => onChange({ start: v, end: end < v ? v : end })} />
        <DateInput id="bp-end" label="End date" value={end} min={start} onChange={(v) => onChange({ end: v })} error={dateError ?? undefined} />
      </div>
      <div className="mt-4">
        <label htmlFor="bp-qty" className="field-label">Number of bicycles</label>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => onChange({ qty: Math.max(1, qty - 1) })} aria-label="One fewer">−</Button>
          <input id="bp-qty" type="number" min={1} className="field w-20 text-center" value={qty} onChange={(e) => onChange({ qty: Math.max(1, Number(e.target.value) || 1) })} />
          <Button variant="outline" onClick={() => onChange({ qty: qty + 1 })} aria-label="One more">+</Button>
        </div>
        <div className="mt-2 min-h-6" aria-live="polite">
          {dateError ? null : free === null ? <Skeleton className="h-6 w-40" /> : qtyError ? <p className="field-error mt-0">{qtyError}</p> : <AvailabilityChip free={free} />}
        </div>
      </div>
      {q && (
        <div className="mt-5 rounded-xl bg-tint/50 p-4" aria-live="polite">
          <p className="text-sm text-ink-soft">{q.breakdown}</p>
          <p className="mt-2 flex items-baseline justify-between"><span className="font-semibold">Line total</span><span className="text-2xl font-bold">{formatMoney(q.line_total)}</span></p>
        </div>
      )}
      {cartDatesDiffer && <Alert tone="low" className="mt-4">Your cart uses {c.start_date} – {c.end_date}. Adding this bicycle moves the whole cart to these dates.</Alert>}
      <Button size="lg" className="mt-5 w-full" disabled={!q || free === null || !!qtyError}
        onClick={() => { cart.setDates(start, end); cart.add(listing.id, qty); onAdded(); }}>
        <ShoppingBag size={18} /> Add to cart
      </Button>
    </div>
  );
}

export default function BicycleDetail() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const c = useCart();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [state, setState] = useState({
    start: params.get("start") ?? c.start_date,
    end: params.get("end") ?? c.end_date,
    qty: Math.max(1, Number(params.get("qty")) || 1),
  });

  const { data, loading } = useData(async () => {
    const listing = await getListingBySlug(slug);
    if (!listing) return null;
    const [images, categories, discounts] = await Promise.all([listListingImages(listing.id), listCategories(), listPublicDiscounts()]);
    return { listing, images: [...images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order), categories, discounts };
  }, [slug]);

  if (loading) return <div className="container-page grid gap-10 py-14 lg:grid-cols-[1.4fr_1fr]"><Skeleton className="aspect-[4/3] rounded-3xl" /><Skeleton className="h-[520px] rounded-2xl" /></div>;
  if (!data) return <NotFound />;
  const { listing, images, categories, discounts } = data;
  const category = categories.find((x) => x.id === listing.category_id);
  const panel = (
    <BookingPanel listing={listing} discounts={discounts} {...state} onChange={(p) => setState((s) => ({ ...s, ...p }))}
      onAdded={() => { setAdded(true); setSheetOpen(false); }} />
  );

  return (
    <div className="container-page pb-28 pt-10 lg:pb-16">
      <Link to="/bicycles" className="mb-6 inline-flex items-center gap-2 font-medium text-primary hover:underline"><ArrowLeft size={17} /> All bicycles</Link>
      {added && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-status-available/30 bg-status-available-bg px-4 py-3 text-status-available" role="status">
          <span className="font-semibold">Added to your cart.</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("/bicycles")}>Add another bicycle</Button>
            <Button size="sm" variant="primary" onClick={() => navigate("/cart")}>View cart</Button>
          </div>
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <Gallery images={images} name={listing.name} />
          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-3">{category && <p className="eyebrow">{category.name}</p>}<TypeChip listing={listing} /></div>
            <h1 className="h-display mt-2 text-5xl sm:text-6xl">{listing.name}</h1>
            <div className="mt-3"><DailyPrice listing={listing} discounts={discounts} day={state.start} large /></div>
            <p className="mt-4 text-lg leading-relaxed text-ink-soft">{listing.description}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {listing.features.map((f) => <li key={f} className="inline-flex items-center gap-1.5 rounded-md bg-tint px-3 py-1.5 text-sm font-medium"><Check size={14} className="text-primary" aria-hidden /> {f}</li>)}
            </ul>
            <p className="mt-5 flex items-center gap-2 text-ink-soft"><Ruler size={18} className="text-primary" aria-hidden /> Fits riders {listing.rider_height_min_cm}–{listing.rider_height_max_cm} cm</p>
            <p className="mt-3 text-sm text-ink-soft">You book this type of bicycle; the exact bicycle and its number are recorded when you collect it.</p>
          </div>
        </div>
        <aside className="hidden lg:block"><div className="card sticky top-24 p-7">{panel}</div></aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <DailyPrice listing={listing} discounts={discounts} day={state.start} />
          <Button onClick={() => setSheetOpen(true)}>Choose dates</Button>
        </div>
      </div>
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={listing.name} side="bottom">{panel}</Sheet>
    </div>
  );
}
