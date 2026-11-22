import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AvailabilityChip, DateInput, ImageBox } from "@/components/bikes";
import { Alert, Button, ButtonLink, EmptyState, PageHeading, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { availabilityForAll, listListingImages, listListings, listPublicDiscounts, primaryImageFor } from "@/lib/api";
import { cart, useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { quoteCart } from "@/lib/pricing";
import { validateDates } from "@/lib/rules";
import { formatDate, scDate } from "@/lib/time";

/** Shared by the cart and checkout: listings, discounts and per-day availability for the cart's dates. */
export function useCartData() {
  const c = useCart();
  const dateError = validateDates(c.start_date, c.end_date);
  const res = useData(async () => {
    const [listings, images, discounts, availability] = await Promise.all([
      listListings(), listListingImages(), listPublicDiscounts(), dateError ? Promise.resolve({} as Record<string, number>) : availabilityForAll(c.start_date, c.end_date),
    ]);
    return { listings, images, discounts, availability };
  }, [c.start_date, c.end_date]);

  const lines = useMemo(() => (res.data ? c.lines.map((l) => ({ ...l, listing: res.data!.listings.find((x) => x.id === l.listing_id) })) : []), [c.lines, res.data]);
  const problems = lines.filter((l) => !l.listing || (res.data?.availability[l.listing_id] ?? 0) < l.quantity);
  const quote = useMemo(() => (res.data && !dateError
    ? quoteCart(lines.filter((l) => l.listing).map((l) => ({ listing: l.listing!, quantity: l.quantity })), c.start_date, c.end_date, res.data.discounts)
    : null), [lines, res.data, dateError, c.start_date, c.end_date]);

  return { c, ...res, lines, problems, quote, dateError };
}

export default function CartPage() {
  const navigate = useNavigate();
  const { c, data, loading, lines, problems, quote, dateError } = useCartData();

  if (c.lines.length === 0) {
    return (
      <div className="container-page py-14">
        <PageHeading title="Your cart" />
        <EmptyState icon={<ShoppingBag />} title="Your cart is empty" action={<ButtonLink to="/bicycles">Browse bicycles</ButtonLink>}>
          Add one or several bicycles. Everyone in your group rides on the same dates.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container-page py-14">
      <PageHeading title="Your cart">One set of dates for every bicycle in your booking.</PageHeading>
      <div className="grid items-start gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="card grid gap-4 p-5 sm:grid-cols-2" aria-label="Rental dates">
            <DateInput id="c-start" label="Start date" value={c.start_date} min={scDate(new Date())} onChange={(v) => cart.setDates(v, c.end_date < v ? v : c.end_date)} />
            <DateInput id="c-end" label="End date" value={c.end_date} min={c.start_date} onChange={(v) => cart.setDates(c.start_date, v)} error={dateError ?? undefined} />
            {quote && <p className="text-sm text-ink-soft sm:col-span-2">{formatDate(c.start_date)} – {formatDate(c.end_date)} · <b className="text-ink">{quote.days} {quote.days === 1 ? "day" : "days"}</b> charged per bicycle. Changing the dates re-checks every bicycle.</p>}
          </section>

          {loading || !data ? <Skeleton className="h-40 rounded-2xl" /> : lines.map((l, idx) => {
            const free = data.availability[l.listing_id] ?? 0;
            const q = quote?.lines.find((x) => x.listing_id === l.listing_id);
            const bad = !l.listing || free < l.quantity;
            return (
              <article key={l.listing_id} className={`card flex flex-col gap-4 p-4 sm:flex-row ${bad ? "border-status-overdue/50 ring-1 ring-status-overdue/30" : ""}`}>
                <ImageBox src={primaryImageFor(l.listing_id, data.images)} alt="" className="h-28 w-full shrink-0 rounded-xl sm:w-36" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{l.listing?.name ?? "No longer available"}</h2>
                      {l.listing && <p className="text-sm text-ink-soft">{formatMoney(l.listing.daily_price)} / day</p>}
                    </div>
                    <button onClick={() => cart.remove(l.listing_id)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-status-overdue-bg hover:text-status-overdue" aria-label={`Remove ${l.listing?.name ?? "line"}`}><Trash2 size={17} /></button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1" role="group" aria-label="Quantity">
                      <Button size="sm" variant="outline" onClick={() => cart.setQuantity(l.listing_id, l.quantity - 1)} aria-label="One fewer" disabled={l.quantity <= 1}>−</Button>
                      <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">{l.quantity}</span>
                      <Button size="sm" variant="outline" onClick={() => cart.setQuantity(l.listing_id, l.quantity + 1)} aria-label="One more">+</Button>
                    </div>
                    {!dateError && <AvailabilityChip free={free} />}
                  </div>
                  {bad && !dateError && <p className="field-error">{free === 0 ? "Not available for these dates. Change the dates or remove it." : `Only ${free} available for these dates. Lower the quantity.`}</p>}
                  {q && <p className="mt-2 text-sm text-ink-soft">{q.breakdown}</p>}
                </div>
                {q && <p className="text-right text-lg font-bold sm:w-24" aria-label={`Line ${idx + 1} total`}>{formatMoney(q.line_total)}</p>}
              </article>
            );
          })}
          <Link to="/bicycles" className="inline-flex font-semibold text-primary hover:underline">+ Add another bicycle</Link>
        </div>

        <aside className="card p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Summary</h2>
          {quote ? (
            <dl className="mt-4 space-y-2.5">
              <div className="flex justify-between"><dt>Subtotal ({quote.bicycles} {quote.bicycles === 1 ? "bicycle" : "bicycles"})</dt><dd>{formatMoney(quote.subtotal)}</dd></div>
              {quote.discount_total > 0 && <div className="flex justify-between font-medium text-status-available"><dt>Discounts</dt><dd>−{formatMoney(quote.discount_total)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-line pt-3"><dt className="text-xl font-bold">Total</dt><dd className="text-2xl font-bold">{formatMoney(quote.total)}</dd></div>
              <p className="text-xs text-ink-soft">Delivery to your hotel (if chosen) is added at checkout.</p>
            </dl>
          ) : <Skeleton className="mt-4 h-24" />}
          {problems.length > 0 && <Alert className="mt-4">Fix the highlighted bicycles before checking out.</Alert>}
          <Button size="lg" className="mt-5 w-full" disabled={!quote || problems.length > 0 || !!dateError} onClick={() => navigate("/checkout")}>
            Continue to checkout <ArrowRight size={18} />
          </Button>
        </aside>
      </div>
    </div>
  );
}
