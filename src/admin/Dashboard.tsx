import { AlertTriangle, ArrowDownToLine, Banknote, Bike, CalendarCheck, CircleDollarSign, Lock, MapPin, Percent, Truck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { PaymentBadge, StatusBadge } from "@/components/booking";
import { Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { adminData } from "@/lib/api";
import { bikesSummary } from "@/lib/emails";
import { formatMoney } from "@/lib/money";
import { bookingsPerDay, dashboard } from "@/lib/reports";
import { formatDate, scDate } from "@/lib/time";
import type { Booking, Listing } from "@/lib/types";
import { AdminTitle } from "./AdminLayout";

function Stat({ icon, label, value, sub, to, warn }: { icon: ReactNode; label: string; value: ReactNode; sub?: string; to?: string; warn?: boolean }) {
  const body = (
    <div className={`card h-full p-4 transition hover:shadow-lift ${warn ? "border-status-overdue/40" : ""}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-ink-soft"><span className={warn ? "text-status-overdue" : "text-primary"}>{icon}</span> {label}</div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-ink-soft">{sub}</p>}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

/** Bookings per day: one series, no legend; hover shows the value; a hidden table for screen readers. */
function LineChart({ series }: { series: { date: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 200, P = { l: 30, r: 10, t: 10, b: 26 };
  const max = Math.max(4, ...series.map((d) => d.count));
  const top = Math.ceil(max / 2) * 2;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (series.length - 1);
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / top);
  const path = series.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(" ");
  const h = hover !== null ? series[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Bookings per day, last 30 days" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((((e.clientX - r.left) / r.width) * W - P.l) / (W - P.l - P.r)) * (series.length - 1));
          setHover(Math.max(0, Math.min(series.length - 1, i)));
        }}>
        {[0, top / 2, top].map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--re-border))" /><text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="rgb(var(--re-ink-soft))">{t}</text></g>)}
        {[0, 15, series.length - 1].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"} fontSize={11} fill="rgb(var(--re-ink-soft))">{formatDate(series[i].date).replace(/ \d{4}$/, "")}</text>)}
        <path d={`${path} L${x(series.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="rgb(var(--re-primary) / 0.08)" />
        <path d={path} fill="none" stroke="rgb(var(--re-primary))" strokeWidth={2} strokeLinejoin="round" />
        {h && hover !== null && <><line x1={x(hover)} x2={x(hover)} y1={P.t} y2={y(0)} stroke="rgb(var(--re-ink) / .3)" strokeDasharray="3 3" /><circle cx={x(hover)} cy={y(h.count)} r={5} fill="rgb(var(--re-primary))" stroke="rgb(var(--re-surface))" strokeWidth={2} /></>}
      </svg>
      {h && hover !== null && <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-island px-3 py-1.5 text-xs text-white" style={{ left: `${(x(hover) / W) * 100}%` }}><b>{h.count}</b> · {formatDate(h.date)}</div>}
      <table className="sr-only"><caption>Bookings per day</caption><tbody>{series.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.count}</td></tr>)}</tbody></table>
    </div>
  );
}

function List({ title, items, listings, empty, extra }: { title: string; items: Booking[]; listings: Listing[]; empty: string; extra?: (b: Booking) => ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title} <span className="text-ink-soft">({items.length})</span></h2>
      {items.length === 0 ? <p className="mt-3 rounded-xl bg-tint/50 p-4 text-sm text-ink-soft">{empty}</p> : (
        <ul className="mt-2 divide-y divide-line">
          {items.slice(0, 8).map((b) => (
            <li key={b.id}>
              <Link to={`/admin/bookings/${b.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.time_needed} · {b.guest_name}</p>
                  <p className="truncate text-sm text-ink-soft">{bikesSummary(b, listings)}{extra ? <> · {extra(b)}</> : null}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={b.status} /><PaymentBadge booking={b} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Dashboard() {
  const { data, loading } = useData(adminData);
  if (loading || !data) return <><AdminTitle title="Today" /><div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div></>;
  const d = dashboard(data.bookings);
  const handovers = [...d.pickupsToday, ...d.deliveriesToday].sort((a, b) => a.time_needed.localeCompare(b.time_needed));

  return (
    <>
      <AdminTitle title="Today">{formatDate(scDate(new Date()))} · Seychelles time</AdminTitle>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat icon={<MapPin size={16} />} label="Pickups today" value={d.pickupsToday.length} to="/admin/bookings" />
        <Stat icon={<Truck size={16} />} label="Deliveries today" value={d.deliveriesToday.length} to="/admin/bookings" />
        <Stat icon={<ArrowDownToLine size={16} />} label="Returns today" value={d.returnsToday.length} />
        <Stat icon={<Bike size={16} />} label="Bicycles out now" value={d.bicyclesOut} />
        <Stat icon={<Banknote size={16} />} label="Cash due today" value={formatMoney(d.cashDueToday)} />
        <Stat icon={<CalendarCheck size={16} />} label="Bookings this month" value={d.bookingsThisMonth} />
        <Stat icon={<CircleDollarSign size={16} />} label="Revenue this month" value={formatMoney(d.revenueThisMonth)} sub="Handed over and completed" to="/admin/reports" />
        <Stat icon={<Percent size={16} />} label="Commission this month" value={formatMoney(d.commissionThisMonth)} to="/admin/reports" />
        <Stat icon={<AlertTriangle size={16} />} label="Need a vendor" value={d.needsVendor.length} warn={d.needsVendor.length > 0} />
        <Stat icon={<Lock size={16} />} label="Locked bookings" value={d.locked.length} warn={d.locked.length > 0} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <List title="Today's handovers" items={handovers} listings={data.listings} empty="No pickups or deliveries today." extra={(b) => (b.fulfilment === "pickup" ? "pickup" : "delivery")} />
        <List title="Today's returns" items={d.returnsToday} listings={data.listings} empty="No returns due today." />
        <List title="Needs action: assign a vendor" items={d.needsVendor} listings={data.listings} empty="Every upcoming bicycle has a vendor." extra={(b) => formatDate(b.start_date)} />
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-semibold">Bookings per day</h2>
        <p className="text-sm text-ink-soft">Last 30 days, by booking date</p>
        <div className="mt-3"><LineChart series={bookingsPerDay(data.bookings)} /></div>
      </section>
    </>
  );
}
