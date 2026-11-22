import { Clock, MapPin, Truck } from "lucide-react";
import { DirectionsButton } from "@/components/MapView";
import { ButtonLink, PageHeading, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { getSettings, listPickupPoints } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { TZ_LABEL } from "@/lib/time";
import { STEPS } from "./Home";

export function HowItWorks() {
  const { data } = useData(async () => ({ settings: await getSettings(), pickups: await listPickupPoints() }));
  const s = data?.settings;
  return (
    <div className="container-page py-14">
      <PageHeading eyebrow="Less planning. More pedalling." title="How it works">Book online, collect with your PIN, ride the island.</PageHeading>
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((st, i) => (
          <li key={st.title} className="card p-6">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-tint text-primary"><st.icon size={22} aria-hidden /></span>
            <p className="mt-5 text-lg font-medium"><span className="text-primary">{i + 1}.</span> {st.title}</p>
            <p className="mt-1 text-ink-soft">{st.text}</p>
          </li>
        ))}
      </ol>
      {!data || !s ? <Skeleton className="mt-12 h-64 rounded-3xl" /> : (
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><MapPin className="text-primary" aria-hidden /> Self-pickup points</h2>
            <ul className="mt-4 space-y-5">
              {data.pickups.map((p) => (
                <li key={p.id}>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-ink-soft">{p.address} · open {p.opens_at}–{p.closes_at} ({TZ_LABEL})</p>
                  <p className="mt-1 text-sm text-ink-soft">{p.instructions}</p>
                  <div className="mt-2"><DirectionsButton lat={p.latitude} lng={p.longitude} /></div>
                </li>
              ))}
            </ul>
          </section>
          <section className="card p-6">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Truck className="text-primary" aria-hidden /> Delivery to your hotel</h2>
            <p className="mt-4 text-ink-soft">We bring the bicycles to your hotel reception at the time you choose. Delivery costs {formatMoney(s.delivery_fee)} per booking and needs {s.booking_min_notice_hours_delivery} hours' notice.</p>
            <h2 className="mt-6 flex items-center gap-2 text-xl font-semibold"><Clock className="text-primary" aria-hidden /> Returning</h2>
            <p className="mt-2 text-ink-soft">Return by {s.return_time} on your last day. Free cancellation until {s.free_cancellation_hours} hours before your start.</p>
            <ButtonLink to="/bicycles" className="mt-6">Choose bicycles</ButtonLink>
          </section>
        </div>
      )}
    </div>
  );
}

export function Terms() {
  const { data: s, loading } = useData(getSettings);
  return (
    <div className="container-page max-w-3xl py-14">
      <PageHeading eyebrow="The small print, kept short" title="Rental terms" />
      {loading || !s ? <div className="space-y-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-5" />)}</div>
        : <div className="card space-y-4 p-7 leading-relaxed text-ink-soft">{s.terms_text.split(/\n{2,}/).map((p) => <p key={p}>{p}</p>)}</div>}
    </div>
  );
}
