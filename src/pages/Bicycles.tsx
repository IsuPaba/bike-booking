import { CalendarDays, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CardSkeleton, ListingCard } from "@/components/bikes";
import { Button, EmptyState, PageHeading, Sheet, Toggle } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { availabilityForAll, listCategories, listListingImages, listListings, listPublicDiscounts, primaryImageFor } from "@/lib/api";
import { daysCharged, priceOnDay } from "@/lib/pricing";
import { validateDates } from "@/lib/rules";
import { formatDate, scDate } from "@/lib/time";

type Sort = "recommended" | "price-asc" | "price-desc";

export default function Bicycles() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showUnavailable, setShowUnavailable] = useState(false);

  const category = params.get("category") ?? "";
  const type = params.get("type") ?? "";
  const height = params.get("height") ?? "";
  const sort = (params.get("sort") as Sort) ?? "recommended";
  const start = params.get("start");
  const end = params.get("end");
  const datesOk = !!start && !!end && !validateDates(start, end);
  const qty = Math.max(1, Number(params.get("qty")) || 1);

  const { data, loading } = useData(async () => {
    const [listings, categories, images, discounts, availability] = await Promise.all([
      listListings(), listCategories(), listListingImages(), listPublicDiscounts(), datesOk ? availabilityForAll(start!, end!) : Promise.resolve(null),
    ]);
    return { listings, categories, images, discounts, availability };
  }, [start, end]);

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const clearFilters = () => {
    const next = new URLSearchParams();
    ["start", "end", "qty"].forEach((k) => params.get(k) && next.set(k, params.get(k)!));
    setParams(next, { replace: true });
  };

  const day = datesOk ? start! : scDate(new Date());
  const { visible, hidden } = useMemo(() => {
    if (!data) return { visible: [], hidden: 0 };
    const h = Number(height);
    const list = data.listings.filter((l) =>
      (!category || l.category_id === category) && (!type || l.bike_type === type) &&
      (!h || (h >= l.rider_height_min_cm && h <= l.rider_height_max_cm)));
    const price = (id: string) => priceOnDay(data.listings.find((l) => l.id === id)!, day, data.discounts).price;
    if (sort === "price-asc") list.sort((a, b) => price(a.id) - price(b.id));
    if (sort === "price-desc") list.sort((a, b) => price(b.id) - price(a.id));
    if (!data.availability) return { visible: list, hidden: 0 };
    const enough = list.filter((l) => (data.availability![l.id] ?? 0) >= qty);
    return { visible: showUnavailable ? [...enough, ...list.filter((l) => !enough.includes(l))] : enough, hidden: list.length - enough.length };
  }, [data, category, type, height, sort, day, qty, showUnavailable]);

  const activeFilters = [category, type, height].filter(Boolean).length;
  const dateQuery = datesOk ? `?${new URLSearchParams({ start: start!, end: end!, qty: String(qty) })}` : "";

  const filters: ReactNode = (
    <div className="grid gap-4 md:grid-cols-4">
      <div>
        <label className="field-label" htmlFor="f-cat">Category</label>
        <select id="f-cat" className="field" value={category} onChange={(e) => update("category", e.target.value)}>
          <option value="">All categories</option>
          {data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="f-type">Type</label>
        <select id="f-type" className="field" value={type} onChange={(e) => update("type", e.target.value)}>
          <option value="">Standard and electric</option>
          <option value="standard">Standard only</option>
          <option value="electric">Electric only</option>
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="f-height">Rider height (cm)</label>
        <input id="f-height" className="field" inputMode="numeric" placeholder="e.g. 170" value={height} onChange={(e) => update("height", e.target.value.replace(/\D/g, "").slice(0, 3))} />
      </div>
      <div>
        <label className="field-label" htmlFor="f-sort">Sort by</label>
        <select id="f-sort" className="field" value={sort} onChange={(e) => update("sort", e.target.value === "recommended" ? null : e.target.value)}>
          <option value="recommended">Recommended</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="container-page py-14">
      <PageHeading eyebrow="Your island, your pace" title="Bicycles">Priced per day — collect any time on your first day.</PageHeading>

      {datesOk && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
          <p className="flex items-center gap-2 font-medium"><CalendarDays size={18} className="text-primary" aria-hidden />
            {formatDate(start!)} – {formatDate(end!)} · {daysCharged(start!, end!)} {daysCharged(start!, end!) === 1 ? "day" : "days"} · {qty} {qty === 1 ? "bicycle" : "bicycles"}</p>
          <Link to="/" className="text-sm font-semibold text-primary hover:underline">Change dates</Link>
        </div>
      )}

      <div className="hidden md:block">{filters}</div>
      <div className="md:hidden">
        <Button variant="outline" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal size={17} /> Filters & sort {activeFilters > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-ink">{activeFilters}</span>}
        </Button>
      </div>
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters & sort" side="bottom">
        {filters}
        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={clearFilters}>Clear</Button>
          <Button className="flex-1" onClick={() => setFiltersOpen(false)}>Show {visible.length}</Button>
        </div>
      </Sheet>

      <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-3 text-ink-soft">
        <div className="flex flex-wrap items-center gap-4">
          {activeFilters > 0 && <button onClick={clearFilters} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"><X size={15} /> Clear filters</button>}
          {data?.availability && hidden > 0 && <Toggle checked={showUnavailable} onChange={setShowUnavailable} label={`Show unavailable (${hidden})`} />}
        </div>
        {!loading && <span aria-live="polite">{visible.length} {visible.length === 1 ? "bicycle" : "bicycles"}</span>}
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading || !data ? Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)
          : visible.map((l) => (
            <ListingCard key={l.id} listing={l} discounts={data.discounts} day={day} category={data.categories.find((c) => c.id === l.category_id)}
              image={primaryImageFor(l.id, data.images)} free={data.availability ? data.availability[l.id] ?? 0 : undefined} linkSearch={dateQuery} />
          ))}
      </div>
      {!loading && data && visible.length === 0 && (
        <EmptyState icon={<SearchX />} title="No bicycles match" action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}>
          {hidden > 0 ? "Everything that matches is booked for these dates. Try other dates or show unavailable bicycles." : "Try another category or clear the rider height."}
        </EmptyState>
      )}
    </div>
  );
}
