import { Lock, Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { METHOD_LABEL, PaymentBadge, STATUS_LABEL, StatusBadge } from "@/components/booking";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { adminData } from "@/lib/api";
import { bikesSummary } from "@/lib/emails";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";
import type { BookingStatus } from "@/lib/types";
import { AdminTitle, Table } from "./AdminLayout";

const STATUSES: BookingStatus[] = ["awaiting_payment", "confirmed", "with_tourist", "completed", "cancelled", "no_show"];

export default function BookingsAdmin() {
  const navigate = useNavigate();
  const { data, loading } = useData(adminData);
  const [f, setF] = useState({ q: "", status: "", fulfilment: "", method: "", vendor: "", from: "", to: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return [...(data?.bookings ?? [])].sort((a, b) => b.start_date.localeCompare(a.start_date) || a.time_needed.localeCompare(b.time_needed)).filter((b) =>
      (!f.status || b.status === f.status) && (!f.fulfilment || b.fulfilment === f.fulfilment) && (!f.method || b.payment_method === f.method) &&
      (!f.vendor || (f.vendor === "none" ? b.items.some((i) => !i.vendor_id) : b.items.some((i) => i.vendor_id === f.vendor))) &&
      (!f.from || b.end_date >= f.from) && (!f.to || b.start_date <= f.to) &&
      (!q || b.reference.toLowerCase().includes(q) || b.guest_name.toLowerCase().includes(q) || b.guest_email.toLowerCase().includes(q)));
  }, [data, f]);

  return (
    <>
      <AdminTitle title="Bookings">Search, filter and open any booking.</AdminTitle>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" size={18} aria-hidden />
          <input className="field pl-11" placeholder="Reference, name or email" aria-label="Search bookings" value={f.q} onChange={set("q")} />
        </div>
        <input type="date" className="field" aria-label="From date" value={f.from} onChange={set("from")} />
        <input type="date" className="field" aria-label="To date" value={f.to} onChange={set("to")} />
        <select className="field" aria-label="Status" value={f.status} onChange={set("status")}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
        <select className="field" aria-label="Pickup or delivery" value={f.fulfilment} onChange={set("fulfilment")}><option value="">Pickup and delivery</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select>
        <select className="field" aria-label="Payment method" value={f.method} onChange={set("method")}><option value="">All payment methods</option><option value="card">Card</option><option value="google_pay">Google Pay</option><option value="cash">Cash</option></select>
        <select className="field" aria-label="Vendor" value={f.vendor} onChange={set("vendor")}><option value="">All vendors</option><option value="none">Vendor not assigned</option>{data?.vendors.map((v) => <option key={v.id} value={v.id}>{v.business_name}</option>)}</select>
      </div>
      {loading || !data ? <div className="space-y-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        : rows.length === 0 ? <EmptyState icon={<SearchX />} title="No bookings match" action={<Button variant="outline" onClick={() => setF({ q: "", status: "", fulfilment: "", method: "", vendor: "", from: "", to: "" })}>Clear filters</Button>} />
        : (
          <Table minWidth={1080} head={["Reference", "Guest", "Dates", "Bicycles", "Fulfilment", "Payment", "Status", "Vendor(s)"]}>
            {rows.map((b) => {
              const vendors = [...new Set(b.items.map((i) => data.vendors.find((v) => v.id === i.vendor_id)?.business_name ?? null))];
              return (
                <tr key={b.id} className="cursor-pointer hover:bg-tint/30" onClick={() => navigate(`/admin/bookings/${b.id}`)}>
                  <td className="px-4 py-3"><button className="font-mono font-semibold text-primary hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/admin/bookings/${b.id}`); }}>{b.reference}</button>
                    {b.is_locked && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-status-overdue"><Lock size={12} /> Locked</span>}</td>
                  <td className="px-4 py-3"><p className="font-medium">{b.guest_name}</p><p className="text-ink-soft">{b.guest_email}</p></td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(b.start_date)} – {formatDate(b.end_date)}</td>
                  <td className="px-4 py-3">{bikesSummary(b, data.listings)}</td>
                  <td className="px-4 py-3 capitalize">{b.fulfilment}<p className="text-ink-soft">{b.time_needed}</p></td>
                  <td className="px-4 py-3">{METHOD_LABEL[b.payment_method]} · {formatMoney(b.total)}<div className="mt-1"><PaymentBadge booking={b} /></div></td>
                  <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                  <td className="px-4 py-3">{vendors.map((v) => v ?? <span key="none" className="font-semibold text-status-low">Not assigned</span>).map((v, i) => <div key={i}>{v}</div>)}</td>
                </tr>
              );
            })}
          </Table>
        )}
    </>
  );
}
