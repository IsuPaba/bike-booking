import clsx from "clsx";
import { ArrowLeft, CheckCircle2, Delete, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PaymentBadge, StatusBadge } from "@/components/booking";
import { Alert, Button, ButtonLink, EmptyState, Skeleton, Toggle } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, recordHandover, staffGetBooking, staffLookups, verifyPin } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { handoverConflicts, maskPhone, type HandoverEntry } from "@/lib/rules";
import { formatDate } from "@/lib/time";

function PinPad({ onSubmit, busy }: { onSubmit: (pin: string) => void; busy: boolean }) {
  const [pin, setPin] = useState("");
  useEffect(() => {
    if (pin.length === 4) {
      onSubmit(pin);
      setPin("");
    }
  }, [pin, onSubmit]);
  const press = (d: string) => !busy && setPin((p) => (p.length < 4 ? p + d : p));
  return (
    <div className="mx-auto max-w-xs">
      <div className="flex justify-center gap-3" aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={clsx("grid h-16 w-14 place-items-center rounded-2xl border-2 text-3xl font-bold", i < pin.length ? "border-primary bg-tint" : "border-line bg-surface")}>{i < pin.length ? "•" : ""}</span>)}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} onClick={() => press(d)} className="h-16 rounded-2xl bg-surface text-2xl font-bold shadow-soft ring-1 ring-line active:bg-tint">{d}</button>
        ))}
        <span />
        <button onClick={() => press("0")} className="h-16 rounded-2xl bg-surface text-2xl font-bold shadow-soft ring-1 ring-line active:bg-tint">0</button>
        <button onClick={() => setPin((p) => p.slice(0, -1))} className="grid h-16 place-items-center rounded-2xl text-ink-soft active:bg-tint" aria-label="Delete last digit"><Delete /></button>
      </div>
    </div>
  );
}

export default function StaffHandover() {
  const { id = "" } = useParams();
  const { data, loading, reload } = useData(async () => ({ b: await staffGetBooking(id), lookups: await staffLookups() }), [id]);
  const [showPassport, setShowPassport] = useState(false);
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [entries, setEntries] = useState<HandoverEntry[]>([]);
  const [cashReceived, setCashReceived] = useState(false);
  const [cashAmount, setCashAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (data?.b && entries.length === 0) {
      setEntries(data.b.items.map((i) => ({ item_id: i.id, vendor_id: i.vendor_id ?? "", bicycle_number: i.bicycle_number ?? "" })));
      setCashAmount(data.b.total.toFixed(2));
    }
  }, [data, entries.length]);

  if (loading) return <Skeleton className="h-96 rounded-2xl" />;
  const b = data?.b;
  if (!b || !data) return <EmptyState title="Booking not found" action={<ButtonLink to="/staff">Back to today</ButtonLink>} />;
  const listingName = (lid: string) => data.lookups.listings.find((l) => l.id === lid)?.name ?? "Bicycle";

  async function checkPin(pin: string) {
    setChecking(true);
    setPinMsg(null);
    try {
      const r = await verifyPin(b!.id, pin);
      if (!r.ok) setPinMsg(r.locked ? "Too many wrong PINs. The booking is locked — ask the admin to unlock it." : `That PIN is wrong. ${r.attemptsLeft} ${r.attemptsLeft === 1 ? "attempt" : "attempts"} left.`);
      reload();
    } finally {
      setChecking(false);
    }
  }

  const conflicts = data.b ? handoverConflicts(b.id, entries.filter((e) => e.vendor_id && e.bicycle_number.trim()), []) : [];
  const cashDue = b.payment_status === "cash_due";

  async function complete() {
    setSaving(true);
    setError(null);
    try {
      await recordHandover(b!.id, entries, cashDue ? { received: cashReceived, amount: Number(cashAmount) || 0 } : null);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't complete the handover.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="py-10 text-center">
        <CheckCircle2 size={72} className="mx-auto text-status-available" aria-hidden />
        <h1 className="h-display mt-4 text-5xl text-status-available">Handed over</h1>
        <p className="mt-2 text-lg text-ink-soft">{b.guest_name} has {b.items.length} {b.items.length === 1 ? "bicycle" : "bicycles"}. Return due {formatDate(b.end_date)} by {data.lookups.return_time}.</p>
        <ButtonLink to="/staff" size="lg" className="mt-8">Back to today</ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/staff" className="inline-flex h-11 items-center gap-2 font-semibold text-primary"><ArrowLeft size={18} /> Today</Link>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xl font-bold">{b.reference}</p>
          <div className="flex gap-1.5"><StatusBadge status={b.status} /><PaymentBadge booking={b} /></div>
        </div>
        <h1 className="mt-2 text-2xl font-bold">{b.guest_name}</h1>
        <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-2 text-[15px]">
          <dt className="text-ink-soft">Phone</dt><dd>{maskPhone(b.guest_phone)}</dd>
          <dt className="text-ink-soft">Passport</dt>
          <dd className="flex items-center gap-2 font-mono">{showPassport ? b.guest_passport : "•".repeat(Math.max(4, b.guest_passport.length))}
            <button onClick={() => setShowPassport((s) => !s)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-tint" aria-label={showPassport ? "Hide passport number" : "Show passport number"}>{showPassport ? <EyeOff size={17} /> : <Eye size={17} />}</button></dd>
          <dt className="text-ink-soft">Hotel</dt><dd>{b.hotel_name ?? "—"} · room {b.room}</dd>
          <dt className="text-ink-soft">{b.fulfilment === "pickup" ? "Pickup" : "Delivery"}</dt><dd>{formatDate(b.start_date)} at {b.time_needed}{b.pickup_point_name ? ` · ${b.pickup_point_name}` : ""}</dd>
          <dt className="text-ink-soft">Return</dt><dd>{formatDate(b.end_date)} by {data.lookups.return_time}</dd>
        </dl>
      </section>

      {b.status === "with_tourist" ? (
        <Alert tone="available">Already handed over. <Link className="underline" to={`/staff/booking/${b.id}/return`}>Record the return</Link></Alert>
      ) : b.status !== "confirmed" ? (
        <Alert tone="low">This booking is {b.status.replace("_", " ")} and can't be handed over.</Alert>
      ) : b.is_locked ? (
        <section className="card p-6 text-center">
          <Lock size={40} className="mx-auto text-status-overdue" aria-hidden />
          <h2 className="mt-3 text-xl font-bold">Booking locked</h2>
          <p className="mt-1 text-ink-soft">Too many wrong PINs were entered. Ask the admin to unlock it, then try again.</p>
          <Button variant="outline" className="mt-4" onClick={reload}>Check again</Button>
        </section>
      ) : !b.pin_verified_at ? (
        <section className="card p-6">
          <h2 className="flex items-center justify-center gap-2 text-xl font-bold"><KeyRound className="text-primary" aria-hidden /> Ask the guest for their PIN</h2>
          <p className="mb-5 mt-1 text-center text-ink-soft">It's in their confirmation email and on Find my booking.</p>
          <PinPad onSubmit={checkPin} busy={checking} />
          {pinMsg && <Alert className="mt-5 text-center text-base">{pinMsg}</Alert>}
          {/* PROTOTYPE ONLY: staff never see the PIN in the real system; it's shown here so the demo can be tested */}
          <p className="mx-auto mt-5 max-w-xs rounded-xl border-2 border-dashed border-line px-4 py-2 text-center text-sm text-ink-soft">
            Prototype hint: this guest's PIN is <b className="font-mono text-base tracking-widest text-ink">{b.pin}</b>. Try a wrong one first to see the attempts counter.
          </p>
        </section>
      ) : (
        <>
          <Alert tone="available">PIN matched. Record each bicycle before handing over.</Alert>
          <section className="card space-y-4 p-5">
            <h2 className="text-xl font-bold">Bicycles</h2>
            {b.items.map((item, idx) => {
              const e = entries.find((x) => x.item_id === item.id) ?? { item_id: item.id, vendor_id: "", bicycle_number: "" };
              const set = (patch: Partial<HandoverEntry>) => setEntries((all) => all.map((x) => (x.item_id === item.id ? { ...x, ...patch } : x)));
              return (
                <div key={item.id} className="rounded-xl border border-line p-4">
                  <p className="font-semibold">{idx + 1}. {listingName(item.listing_id)}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="field-label" htmlFor={`v-${item.id}`}>Vendor</label>
                      <select id={`v-${item.id}`} className="field h-14 text-base" value={e.vendor_id} onChange={(ev) => set({ vendor_id: ev.target.value })}>
                        <option value="">Choose vendor</option>
                        {data.lookups.vendors.map((v) => <option key={v.id} value={v.id}>{v.business_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="field-label" htmlFor={`n-${item.id}`}>Bicycle number</label>
                      <input id={`n-${item.id}`} className="field h-14 font-mono text-lg uppercase" inputMode="numeric" placeholder="e.g. 142" value={e.bicycle_number} onChange={(ev) => set({ bicycle_number: ev.target.value })} />
                    </div>
                  </div>
                </div>
              );
            })}
            {conflicts.length > 0 && <Alert>{conflicts[0]}</Alert>}
          </section>

          {cashDue && (
            <section className="card space-y-4 border-status-low/40 p-5">
              <h2 className="text-xl font-bold">Collect {formatMoney(b.total)} cash</h2>
              <div>
                <label className="field-label" htmlFor="cash">Amount received</label>
                <input id="cash" className="field h-14 text-lg" inputMode="decimal" value={cashAmount} onChange={(e) => setCashAmount(e.target.value.replace(/[^\d.]/g, ""))} />
                {Number(cashAmount) < b.total && <p className="field-error">That's less than the {formatMoney(b.total)} due.</p>}
              </div>
              <Toggle checked={cashReceived} onChange={setCashReceived} label="Cash received" />
            </section>
          )}

          {error && <Alert>{error}</Alert>}
          <Button size="lg" className="h-16 w-full text-lg" loading={saving} onClick={complete}
            disabled={conflicts.length > 0 || entries.some((e) => !e.vendor_id || !e.bicycle_number.trim()) || (cashDue && (!cashReceived || Number(cashAmount) < b.total))}>
            Complete handover
          </Button>
        </>
      )}
    </div>
  );
}
