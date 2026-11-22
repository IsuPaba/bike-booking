import { ArrowRight, Baby, Bike, KeyRound, MapPin, MessageCircle, ShoppingBag, Sparkles, Ticket, Truck, User, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { CardSkeleton, DateSearch, ListingCard } from "@/components/bikes";
import { ButtonLink, buttonClass } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { getSettings, listCategories, listListingImages, listListings, listPublicDiscounts, primaryImageFor } from "@/lib/api";
import { formatMoneyCompact } from "@/lib/money";
import { discountLabel, lowestDailyPrice } from "@/lib/pricing";
import { discountStatus } from "@/lib/reports";
import { addDays, scDate } from "@/lib/time";

export const STEPS = [
  { icon: ShoppingBag, title: "Choose bicycles", text: "Add one or several bicycles to your cart for your dates." },
  { icon: Truck, title: "Pick up or get delivery", text: "Collect at a pickup point or have them brought to your hotel." },
  { icon: KeyRound, title: "Show your PIN", text: "Your 4-digit PIN releases the bicycles at handover." },
  { icon: Bike, title: "Ride the island", text: "Explore at your own pace and return on your last day." },
];

const CATEGORY_ICON: Record<string, typeof User> = { womens: User, mens: User, childrens: Baby, electric: Zap };

export default function Home() {
  const { data, loading } = useData(async () => {
    const [listings, categories, images, discounts, settings] = await Promise.all([listListings(), listCategories(), listListingImages(), listPublicDiscounts(), getSettings()]);
    return { listings, categories, images, discounts, settings };
  });
  const from = data ? lowestDailyPrice(data.listings) : null;
  const live = data?.discounts.find((d) => d.scope === "all" && discountStatus(d) === "Live") ?? data?.discounts.find((d) => discountStatus(d) === "Live");
  const featured = data?.listings.filter((l) => l.is_featured).slice(0, 3) ?? [];
  const s = data?.settings;
  const whatsapp = s?.whatsapp.replace(/[^\d]/g, "");
  const today = scDate(new Date());
  const [first, ...rest] = (s?.tagline ?? "Explore more. Spend less.").split(/(?<=\.)\s+/);

  const faq = s ? [
    { q: "How is the price worked out?", a: "Per calendar day. A rental from Monday to Wednesday is 3 days, whether you collect at 07:00 or at noon. Discounts apply to each rental day inside the offer dates." },
    { q: "When do I return the bicycles?", a: `By ${s.return_time} on your last day, at the pickup point or your hotel reception (for delivery).` },
    { q: "Can I cancel?", a: `Yes, free of charge until ${s.free_cancellation_hours} hours before your start time. You can do it yourself from Find my booking.` },
    { q: "Can I pay in cash?", a: "Yes. Choose “Cash at handover” at checkout and pay when you collect the bicycles." },
  ] : [];

  return (
    <>
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 overflow-hidden bg-island">
          <img src="/images/hero-beach.jpg" alt="" className="h-full w-full object-cover object-[70%_center]" />
          <div className="absolute inset-0 bg-gradient-to-r from-island/90 via-island/60 to-island/0" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-island/50 to-transparent md:hidden" />
        </div>
        <div className="container-page pb-40 pt-16 text-white sm:pt-24 md:pb-44">
          <p className="mb-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-white/90"><MapPin size={16} aria-hidden /> La Digue, Seychelles</p>
          <h1 className="font-display text-7xl uppercase leading-[0.9] tracking-wide sm:text-8xl lg:text-[120px]">Bike for rent</h1>
          <p className="mt-6 text-2xl font-semibold sm:text-3xl">{first} {rest.length > 0 && <span className="text-on-dark-accent">{rest.join(" ")}</span>}</p>
          <p className="mt-3 max-w-md text-[17px] leading-relaxed text-white/90">Pick up at the jetty or have bicycles delivered to your hotel. Pay online or in cash.</p>
          <div className="mt-7 h-12">
            {from !== null && <ButtonLink to="/bicycles">From {formatMoneyCompact(from)} / day <ArrowRight size={17} /></ButtonLink>}
          </div>
        </div>
      </section>

      <div className="container-page relative z-10 -mt-28">
        <DateSearch defaultStart={addDays(today, 1)} defaultEnd={addDays(today, 3)} />
      </div>

      {live && (
        <section className="container-page mt-10" aria-label="Current offer">
          <div className="flex flex-col gap-4 rounded-2xl bg-island px-6 py-6 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="flex items-start gap-4">
              <Ticket className="mt-0.5 shrink-0 text-on-dark-accent" size={26} aria-hidden />
              <div>
                <p className="text-lg font-bold">{live.name} · {discountLabel(live).replace("−", "")} off</p>
                <p className="text-white/85">Applied automatically to every rental day until {new Date(`${live.ends_on}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. No code needed.</p>
              </div>
            </div>
            <Link to="/bicycles" className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-on-dark-accent hover:underline">See the prices <ArrowRight size={16} /></Link>
          </div>
        </section>
      )}

      <section className="container-page mt-14" aria-labelledby="cat-title">
        <h2 id="cat-title" className="h-display text-4xl">Find your fit</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {(data?.categories ?? []).map((c) => {
            const Icon = CATEGORY_ICON[c.slug] ?? Sparkles;
            return (
              <Link key={c.id} to={`/bicycles?category=${c.id}`} className="card group flex flex-col gap-3 p-5 transition hover:-translate-y-1 hover:shadow-lift">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-tint text-primary"><Icon size={22} aria-hidden /></span>
                <span className="text-lg font-semibold group-hover:text-primary">{c.name}</span>
                <span className="text-sm text-ink-soft">{c.description}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="featured-title">
        <p className="eyebrow mb-2">Island favourites</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="featured-title" className="h-display text-5xl sm:text-6xl">A ride for every adventure</h2>
          <Link to="/bicycles" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">All bicycles <ArrowRight size={17} /></Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loading || !data ? Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)
            : featured.map((l) => <ListingCard key={l.id} listing={l} discounts={data.discounts} category={data.categories.find((c) => c.id === l.category_id)} image={primaryImageFor(l.id, data.images)} />)}
        </div>
      </section>

      <section className="border-y border-line bg-surface py-16" aria-labelledby="steps-title">
        <div className="container-page">
          <p className="eyebrow mb-2 text-center">Less planning. More pedalling.</p>
          <h2 id="steps-title" className="h-display text-center text-5xl">How it works</h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st, i) => (
              <li key={st.title}>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-tint text-primary"><st.icon size={22} aria-hidden /></span>
                <p className="mt-5 text-lg font-medium"><span className="text-primary">{i + 1}.</span> {st.title}</p>
                <p className="mt-1 text-ink-soft">{st.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16" aria-labelledby="faq-title">
        <div className="container-page max-w-4xl">
          <h2 id="faq-title" className="h-display text-5xl">Good to know before you go</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {faq.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center gap-3 text-lg font-semibold">
                  <span className="text-primary transition group-open:rotate-90" aria-hidden>▸</span>{f.q}
                </summary>
                <p className="mt-3 pl-7 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/how-it-works" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">More about pickup and delivery <ArrowRight size={16} /></Link>
            {whatsapp && <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}><MessageCircle size={18} /> Chat on WhatsApp</a>}
          </div>
        </div>
      </section>
    </>
  );
}
