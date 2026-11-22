import { ArrowLeft, Eye, EyeOff, Unlock } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { METHOD_LABEL, PaymentBadge, StatusBadge, StatusTimeline } from "@/components/booking";
import { Alert, Badge, Button, ConfirmDialog, Dialog, EmptyState, Field, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, adminBookingAction, adminData, assignVendor, saveInternalNotes, type AdminAction } from "@/lib/api";
import { whereText } from "@/lib/emails";
import { formatMoney } from "@/lib/money";
import { commissionLabel } from "@/lib/pricing";
import { formatDate, formatDateTime } from "@/lib/time";
import { AdminTitle, Table } from "./AdminLayout";

const ACTION_TEXT: Record<AdminAction, { label: string; message: string; danger: boolean }> = {
  no_show: { label: "Mark no-show", message: "The guest didn't come. The bicycles are released.", danger: true },
  unlock: { label: "Unlock PIN", message: "Reset the PIN attempts so staff can try again.", danger: false },
  refund: { label: "Mark refunded", message: "Record that the payment has been refunded (manual; no money moves in the prototype).", danger: true },
};

export default function BookingDetail() {
  const { id = "" } = useParams();
  const { data, loading } = useData(adminData);
  const [showPin, setShowPin] = useState(false);
  const [pending, setPending] = useState<AdminAction | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  if (loading || !data) return <Skeleton className="h-[600px] rounded-2xl" />;
  const b = data.bookings.find((x) => x.id === id);
  if (!b) return <EmptyState title="Booking not found" />;
  const hotel = b.hotel_id ? data.hotels.find((h) => h.id === b.hotel_id)?.name : b.hotel_other_name;
  const emails = data.email_outbox.filter((e) => e.booking_id === b.id);
  const log = data.audit_log.filter((a) => a.entity === "booking" && a.entity_id === b.id).sort((x, y) => x.created_at.localeCompare(y.created_at));
  const actor = (uid: string) => data.users.find((u) => u.id === uid)?.name ?? (uid === "guest" ? "Guest" : uid);
  const closed = b.status === "completed" || b.status === "cancelled" || b.status === "no_show";

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setPending(null);
      setCancelOpen(false);
    }
  }

  return (
    <div className="max-w-6xl">
      <Link to="/admin/bookings" className="mb-4 inline-flex items-center gap-2 font-medium text-primary hover:underline"><ArrowLeft size={17} /> All bookings</Link>
      <AdminTitle title={b.reference} actions={<>
        {b.is_locked && <Button variant="primary" onClick={() => setPending("unlock")}><Unlock size={16} /> Unlock PIN</Button>}
        {b.status === "confirmed" && <Button variant="outline" onClick={() => setPending("no_show")}>Mark no-show</Button>}
        {(b.status === "confirmed" || b.status === "awaiting_payment") && <Button variant="outline" className="text-status-overdue" onClick={() => setCancelOpen(true)}>Cancel booking</Button>}
        {b.payment_status === "paid" && (b.status === "cancelled" || b.status === "no_show" || b.status === "completed") && <Button variant="outline" onClick={() => setPending("refund")}>Mark refunded</Button>}
      </>}>
        <span className="inline-flex flex-wrap items-center gap-2"><StatusBadge status={b.status} /><PaymentBadge booking={b} />{b.is_locked && <Badge tone="overdue">PIN locked ({b.pin_attempts} attempts)</Badge>}</span>
      </AdminTitle>
      {error && <Alert className="mb-5">{error}</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="card p-5"><StatusTimeline booking={b} /></section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Bicycles and vendors</h2>
            <Table minWidth={640} head={["Bicycle", "Price", "Vendor (commission)", "Number", "Condition"]}>
              {b.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium">{data.listings.find((l) => l.id === i.listing_id)?.name}</td>
                  <td className="px-4 py-3">{formatMoney(i.line_total)}<p className="text-xs text-ink-soft">{i.days} days{i.discount_amount ? `, −${formatMoney(i.discount_amount)}` : ""}</p></td>
                  <td className="px-4 py-3">
                    <select className="field py-2" aria-label="Vendor" disabled={closed || busy} value={i.vendor_id ?? ""} onChange={(e) => e.target.value && run(() => assignVendor(b.id, i.id, e.target.value))}>
                      <option value="">Not assigned</option>
                      {data.vendors.filter((v) => v.is_active || v.id === i.vendor_id).map((v) => <option key={v.id} value={v.id}>{v.business_name}</option>)}
                    </select>
                    {i.commission_type && <p className="mt-1 text-xs text-ink-soft">{commissionLabel(i.commission_type, i.commission_value!)} = {formatMoney(i.commission_amount ?? 0)} (rate at assignment)</p>}
                  </td>
                  <td className="px-4 py-3 font-mono">{i.bicycle_number ?? "—"}</td>
                  <td className="px-4 py-3">{i.condition_notes ?? "—"}</td>
                </tr>
              ))}
            </Table>
            <p className="mt-3 text-sm text-ink-soft">{b.items[0]?.price_breakdown.text}</p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Activity</h2>
            {log.length === 0 ? <p className="text-sm text-ink-soft">No activity yet.</p> : (
              <ol className="space-y-2 text-sm">
                {log.map((a) => <li key={a.id} className="flex gap-3"><span className="w-40 shrink-0 text-ink-soft">{formatDateTime(a.created_at)}</span><span><b className="capitalize">{a.action.replace(/_/g, " ")}</b> by {actor(a.actor_id)}{Object.keys(a.details).length ? <span className="text-ink-soft"> · {Object.entries(a.details).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" · ")}</span> : null}</span></li>)}
              </ol>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Emails sent</h2>
            {emails.length === 0 ? <p className="text-sm text-ink-soft">None yet.</p> : (
              <ul className="divide-y divide-line">{emails.map((e) => <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span><b>{e.subject}</b> · {formatDateTime(e.created_at)}</span><Button size="sm" variant="ghost" onClick={() => setPreview(e.body_html)}>Preview</Button></li>)}</ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold">Guest</h2>
            <dl className="grid grid-cols-[100px_1fr] gap-y-1.5 text-sm">
              <dt className="text-ink-soft">Name</dt><dd>{b.guest_name}</dd>
              <dt className="text-ink-soft">Email</dt><dd className="break-all">{b.guest_email}</dd>
              <dt className="text-ink-soft">Phone</dt><dd>{b.guest_phone}</dd>
              <dt className="text-ink-soft">Passport</dt><dd className="font-mono">{b.guest_passport}</dd>
              <dt className="text-ink-soft">Hotel</dt><dd>{hotel ?? "—"} · room {b.room}</dd>
              <dt className="text-ink-soft">PIN</dt><dd className="flex items-center gap-2 font-mono">{showPin ? b.pin : "••••"}
                <button onClick={() => setShowPin((s) => !s)} className="rounded-md p-1 hover:bg-tint" aria-label={showPin ? "Hide PIN" : "Show PIN"}>{showPin ? <EyeOff size={15} /> : <Eye size={15} />}</button></dd>
            </dl>
          </section>
          <section className="card p-5 text-sm">
            <h2 className="mb-3 font-semibold">Rental</h2>
            <p>{formatDate(b.start_date)} – {formatDate(b.end_date)} · return by {data.settings.return_time}</p>
            <p className="mt-1">{whereText(b, data.pickup_points, data.hotels)}</p>
            <dl className="mt-4 space-y-1 rounded-xl bg-tint/50 p-3">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(b.subtotal)}</dd></div>
              {b.discount_total > 0 && <div className="flex justify-between text-status-available"><dt>Discounts</dt><dd>−{formatMoney(b.discount_total)}</dd></div>}
              {b.delivery_fee > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatMoney(b.delivery_fee)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-1 font-bold"><dt>Total ({METHOD_LABEL[b.payment_method]})</dt><dd>{formatMoney(b.total)}</dd></div>
              {b.cash_collected_amount !== null && <div className="flex justify-between"><dt>Cash collected</dt><dd>{formatMoney(b.cash_collected_amount)}</dd></div>}
            </dl>
            {b.cancellation_reason && <p className="mt-3 text-status-overdue">Cancelled: {b.cancellation_reason}</p>}
          </section>
          <section className="card p-5">
            <Field label="Internal notes" htmlFor="notes" hint="Only visible to admins.">
              <textarea id="notes" rows={3} className="field" value={notes ?? b.internal_notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button size="sm" variant="outline" className="mt-2" disabled={notes === null} onClick={() => run(() => saveInternalNotes(b.id, notes ?? "")).then(() => setNotes(null))}>Save notes</Button>
          </section>
        </div>
      </div>

      <ConfirmDialog open={!!pending} onCancel={() => setPending(null)} onConfirm={() => pending && run(() => adminBookingAction(b.id, pending))} loading={busy}
        title={pending ? `${ACTION_TEXT[pending].label}?` : ""} confirmLabel={pending ? ACTION_TEXT[pending].label : ""} danger={pending ? ACTION_TEXT[pending].danger : false} message={pending ? ACTION_TEXT[pending].message : ""} />
      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${b.reference}?`}
        footer={<><Button variant="outline" onClick={() => setCancelOpen(false)}>Go back</Button><Button variant="danger" loading={busy} onClick={() => run(() => adminBookingAction(b.id, { cancel: reason }))}>Cancel booking</Button></>}>
        <p>The guest gets a cancellation email and the bicycles are released.</p>
        <Field label="Reason" htmlFor="reason"><input id="reason" className="field mt-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Weather warning" /></Field>
      </Dialog>
      <Dialog open={!!preview} onClose={() => setPreview(null)} title="Email preview" footer={<Button variant="outline" onClick={() => setPreview(null)}>Close</Button>}>
        {/* Our own generated, escaped template */}
        <div className="max-h-[60vh] overflow-auto rounded-lg bg-white p-4" dangerouslySetInnerHTML={{ __html: preview ?? "" }} />
      </Dialog>
    </div>
  );
}
