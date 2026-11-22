import clsx from "clsx";
import { Download, Printer } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { adminData } from "@/lib/api";
import { downloadFile } from "@/lib/ics";
import { formatMoney } from "@/lib/money";
import { byCategory, byFulfilment, byPaymentMethod, byVendor, rentalsSummary, toCsv, vendorStatement } from "@/lib/reports";
import { addDays, formatDate, scDate } from "@/lib/time";
import { AdminTitle, Table } from "./AdminLayout";

type Tab = "rentals" | "vendors" | "categories" | "fulfilment" | "payment" | "statement";
const TABS: [Tab, string][] = [["rentals", "Rentals"], ["vendors", "By vendor"], ["categories", "By category"], ["fulfilment", "Pickup vs delivery"], ["payment", "Online vs cash"], ["statement", "Vendor statement"]];

type Row = Record<string, string | number | null>;
const money = (k: string) => /^(revenue|rentalRevenue|commission|owed|rental|net|deliveryFees|discounts)$/.test(k);
const label = (k: string) => k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

function ReportTable({ rows, name, footer }: { rows: Row[]; name: string; footer?: Row }) {
  if (!rows.length) return <EmptyState title="Nothing in this period">Try a wider date range.</EmptyState>;
  const cols = Object.keys(rows[0]).filter((k) => k !== "vendorId");
  const clean = rows.map((r) => Object.fromEntries(cols.map((c) => [label(c), r[c]])));
  return (
    <div>
      <div className="mb-3 flex justify-end gap-2 no-print">
        <Button size="sm" variant="outline" onClick={() => downloadFile(`${name}.csv`, toCsv(footer ? [...clean, Object.fromEntries(cols.map((c) => [label(c), footer[c] ?? ""]))] : clean), "text/csv")}><Download size={15} /> Export CSV</Button>
      </div>
      <Table minWidth={640} head={cols.map(label)}>
        {rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={clsx("px-4 py-3", typeof r[c] === "number" && "tabular-nums")}>{typeof r[c] === "number" && money(c) ? formatMoney(r[c] as number) : r[c]}</td>)}</tr>)}
        {footer && <tr className="bg-tint/40 font-bold">{cols.map((c) => <td key={c} className="px-4 py-3 tabular-nums">{typeof footer[c] === "number" && money(c) ? formatMoney(footer[c] as number) : footer[c]}</td>)}</tr>}
      </Table>
    </div>
  );
}

function Card({ label: l, value }: { label: string; value: ReactNode }) {
  return <div className="card p-4"><p className="text-sm text-ink-soft">{l}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value}</p></div>;
}

export default function ReportsAdmin() {
  const { data, loading } = useData(adminData);
  const [params, setParams] = useSearchParams();
  const today = scDate(new Date());
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<Tab>(params.get("vendor") ? "statement" : "rentals");
  const vendorId = params.get("vendor") ?? data?.vendors[0]?.id ?? "";

  if (loading || !data) return <Skeleton className="h-96 rounded-2xl" />;
  const range = `${from}_to_${to}`;
  const s = rentalsSummary(data.bookings, from, to);

  return (
    <>
      <AdminTitle title="Reports">Only bookings that were handed over or completed count as revenue, by start date.</AdminTitle>
      <div className="no-print mb-5 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">From<input type="date" className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm font-semibold">To<input type="date" className="field mt-1" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
        {[["This month", `${today.slice(0, 8)}01`, today], ["Last 30 days", addDays(today, -29), today], ["Last 7 days", addDays(today, -6), today]].map(([l, f, t]) => (
          <Button key={l} size="sm" variant="ghost" onClick={() => { setFrom(f); setTo(t); }}>{l}</Button>
        ))}
      </div>
      <div role="tablist" className="no-print mb-6 flex flex-wrap gap-2">
        {TABS.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("rounded-full px-4 py-2 text-sm font-semibold", tab === t ? "bg-primary text-primary-ink" : "bg-surface ring-1 ring-line hover:bg-tint")}>{l}</button>)}
      </div>

      {tab === "rentals" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card label="Bookings" value={s.bookings} /><Card label="Bicycles" value={s.bicycles} /><Card label="Rental days" value={s.rentalDays} /><Card label="Revenue" value={formatMoney(s.revenue)} />
            <Card label="Commission earned" value={formatMoney(s.commission)} /><Card label="Delivery fees" value={formatMoney(s.deliveryFees)} /><Card label="Cancelled" value={s.cancelled} /><Card label="No-shows" value={s.noShow} />
          </div>
          <div className="mt-5"><ReportTable name={`rentals_${range}`} rows={[{ bookings: s.bookings, bicycles: s.bicycles, rentalDays: s.rentalDays, rentalRevenue: s.rentalRevenue, deliveryFees: s.deliveryFees, discounts: s.discounts, revenue: s.revenue, commission: s.commission, cancelled: s.cancelled, noShow: s.noShow }]} /></div>
        </>
      )}
      {tab === "vendors" && (() => {
        const rows = byVendor(data.bookings, data.vendors, from, to);
        const t = { vendor: "Total", bicycles: rows.reduce((a, r) => a + r.bicycles, 0), rentalDays: rows.reduce((a, r) => a + r.rentalDays, 0), revenue: rows.reduce((a, r) => a + r.revenue, 0), commission: rows.reduce((a, r) => a + r.commission, 0), owed: rows.reduce((a, r) => a + r.owed, 0) };
        return <ReportTable name={`by_vendor_${range}`} rows={rows.map(({ vendorId: _v, ...r }) => r)} footer={t} />;
      })()}
      {tab === "categories" && <ReportTable name={`by_category_${range}`} rows={byCategory(data.bookings, data.listings, data.categories, from, to)} />}
      {tab === "fulfilment" && <ReportTable name={`by_fulfilment_${range}`} rows={byFulfilment(data.bookings, from, to)} />}
      {tab === "payment" && <ReportTable name={`by_payment_${range}`} rows={byPaymentMethod(data.bookings, from, to)} />}
      {tab === "statement" && (() => {
        const v = data.vendors.find((x) => x.id === vendorId);
        const st = vendorStatement(data.bookings, data.listings, vendorId, from, to);
        return (
          <section>
            <div className="no-print mb-4 flex flex-wrap items-end gap-3">
              <label className="text-sm font-semibold">Vendor
                <select className="field mt-1" value={vendorId} onChange={(e) => setParams({ vendor: e.target.value })}>{data.vendors.map((x) => <option key={x.id} value={x.id}>{x.business_name}</option>)}</select>
              </label>
              <Button variant="outline" onClick={() => window.print()}><Printer size={16} /> Print</Button>
            </div>
            <div className="card mb-4 p-5">
              <h2 className="text-xl font-bold">Statement · {v?.business_name}</h2>
              <p className="text-ink-soft">{formatDate(from)} – {formatDate(to)} · {st.totals.bicycles} bicycles · {st.totals.days} rental days</p>
              <p className="mt-2">Rental {formatMoney(st.totals.rental)} − commission {formatMoney(st.totals.commission)} = <b>net payable {formatMoney(st.totals.net)}</b></p>
            </div>
            <ReportTable name={`statement_${v?.business_name.replace(/\W+/g, "_")}_${range}`} rows={st.lines}
              footer={{ reference: "Total", start: "", end: "", bicycle: "", bicycleNumber: "", days: st.totals.days, rental: st.totals.rental, commission: st.totals.commission, net: st.totals.net }} />
          </section>
        );
      })()}
    </>
  );
}
