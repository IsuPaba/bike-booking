import { AlertTriangle, CreditCard, FlaskConical, Lock, Timer } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { METHOD_LABEL } from "@/components/booking";
import { DECLINE_CARD, PaymentLogo, luhnValid } from "@/components/payment";
import { Alert, Button, ButtonLink, EmptyState, Field, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, getBookingByReference, payBooking, switchToCash } from "@/lib/api";
import { holdExpiresAt } from "@/lib/availability";
import { recentBookingEmail } from "@/lib/guest";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/time";

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return target ? Math.max(0, Math.floor((target.getTime() - now) / 1000)) : null;
}

type Online = "card" | "google_pay";

export default function Pay() {
  const { reference = "" } = useParams();
  const navigate = useNavigate();
  const email = recentBookingEmail(reference);
  const { data: booking, loading } = useData(() => (email ? getBookingByReference(reference, email) : Promise.resolve(null)), [reference]);
  const [method, setMethod] = useState<Online | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const secondsLeft = useCountdown(booking ? holdExpiresAt(booking.created_at) : null);

  if (!email) return <div className="container-page py-16"><EmptyState title="Open this page from the device you booked on" action={<ButtonLink to="/my-booking">Find my booking</ButtonLink>}>For your security, payment links only work in the browser where the booking was made.</EmptyState></div>;
  if (loading) return <div className="container-page max-w-3xl py-14"><Skeleton className="h-[520px] rounded-2xl" /></div>;
  if (!booking) return <div className="container-page py-16"><EmptyState title="We couldn't find that booking" action={<ButtonLink to="/bicycles">Start again</ButtonLink>} /></div>;
  if (booking.status !== "awaiting_payment") return <Navigate to={`/booking/${booking.reference}`} replace />;
  const active: Online = method ?? (booking.payment_method === "google_pay" ? "google_pay" : "card");

  async function pay(approved: boolean) {
    setBusy(true);
    setFailure(null);
    setError(null);
    try {
      const r = await payBooking(reference, email!, active, approved);
      if (r.payment_status === "paid") navigate(`/booking/${reference}`);
      else setFailure(active === "card" ? "Your card was declined by the bank. No money has been taken." : "Google Pay didn't complete the payment. No money has been taken.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function payCash() {
    setBusy(true);
    try {
      await switchToCash(reference, email!);
      navigate(`/booking/${reference}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't switch to cash.");
      setBusy(false);
    }
  }

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="mb-6 flex items-start gap-3 rounded-xl border-2 border-dashed border-status-low/50 bg-status-low-bg px-4 py-3 text-status-low" role="note">
        <FlaskConical className="mt-0.5 shrink-0" size={20} aria-hidden /><p className="font-semibold">Prototype — simulated payment. No real money is charged.</p>
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-tint/40 p-6">
          <div>
            <p className="text-sm text-ink-soft">Booking {booking.reference} · {formatDate(booking.start_date)} – {formatDate(booking.end_date)} · {booking.items.length} {booking.items.length === 1 ? "bicycle" : "bicycles"}</p>
            <p className="mt-1 text-3xl font-bold">{formatMoney(booking.total)}</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 font-semibold ${secondsLeft === 0 ? "bg-status-overdue-bg text-status-overdue" : "bg-surface"}`} aria-live="polite">
            <Timer size={18} aria-hidden />{secondsLeft === 0 ? "Hold expired" : <>Bicycles held for <span className="tabular-nums">{Math.floor((secondsLeft ?? 0) / 60)}:{String((secondsLeft ?? 0) % 60).padStart(2, "0")}</span></>}
          </div>
        </div>
        <div className="p-6">
          {secondsLeft === 0 && <Alert tone="low" className="mb-5">Your 15-minute hold has ended. You can still pay; we'll check the bicycles are free first.</Alert>}
          <div role="tablist" aria-label="Payment method" className="grid grid-cols-2 gap-2 rounded-xl bg-bg p-1.5">
            {(["card", "google_pay"] as const).map((m) => (
              <button key={m} role="tab" aria-selected={active === m} onClick={() => { setMethod(m); setFailure(null); }}
                className={`flex h-14 items-center justify-center rounded-lg transition ${active === m ? "bg-surface shadow-soft ring-1 ring-line" : "opacity-70 hover:opacity-100"}`}>
                <PaymentLogo method={m} /><span className="sr-only">{METHOD_LABEL[m]}</span>
              </button>
            ))}
          </div>
          {failure && (
            <div className="mt-5 rounded-xl border border-status-overdue/30 bg-status-overdue-bg p-4 text-status-overdue" role="alert">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} aria-hidden /> Payment didn't go through</p>
              <p className="mt-1 text-sm">{failure}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="primary" onClick={() => setFailure(null)}>Try again</Button>
                <Button size="sm" variant="outline" onClick={payCash} loading={busy}>Pay cash instead</Button>
              </div>
            </div>
          )}
          {error && <Alert className="mt-5">{error}</Alert>}
          <div className="mt-6">
            {active === "card" ? <CardForm amount={booking.total} busy={busy} onPay={(declined) => pay(!declined)} />
              : <GooglePaySheet amount={booking.total} busy={busy} onPay={() => pay(true)} onCancel={() => setFailure("You cancelled Google Pay. No money has been taken.")} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardForm({ amount, busy, onPay }: { amount: number; busy: boolean; onPay: (declined: boolean) => void }) {
  const [f, setF] = useState({ name: "", number: "", expiry: "", cvc: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(e: FormEvent) {
    e.preventDefault();
    const digits = f.number.replace(/\D/g, "");
    const next: Record<string, string> = {};
    if (f.name.trim().length < 2) next.name = "Enter the name on the card.";
    if (!luhnValid(digits)) next.number = "That card number doesn't look right.";
    const m = /^(\d{2})\/(\d{2})$/.exec(f.expiry);
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) next.expiry = "Use MM/YY.";
    else if (new Date(2000 + Number(m[2]), Number(m[1])) < new Date()) next.expiry = "This card has expired.";
    if (!/^\d{3,4}$/.test(f.cvc)) next.cvc = "3 or 4 digits.";
    setErrors(next);
    if (!Object.keys(next).length) onPay(digits === DECLINE_CARD);
  }
  const num = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  const exp = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Name on card" htmlFor="cc-name" error={errors.name}><input id="cc-name" className="field" autoComplete="cc-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Card number" htmlFor="cc-number" error={errors.number}>
        <div className="relative">
          <input id="cc-number" className="field pl-11 tabular-nums tracking-wider" inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" value={f.number} onChange={(e) => setF({ ...f, number: num(e.target.value) })} />
          <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" size={18} aria-hidden />
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Expiry" htmlFor="cc-exp" error={errors.expiry}><input id="cc-exp" className="field tabular-nums" inputMode="numeric" placeholder="MM/YY" value={f.expiry} onChange={(e) => setF({ ...f, expiry: exp(e.target.value) })} /></Field>
        <Field label="CVC" htmlFor="cc-cvc" error={errors.cvc}><input id="cc-cvc" className="field tabular-nums" inputMode="numeric" placeholder="123" value={f.cvc} onChange={(e) => setF({ ...f, cvc: e.target.value.replace(/\D/g, "").slice(0, 4) })} /></Field>
      </div>
      <div className="rounded-xl bg-tint/60 p-4 text-sm">
        <p className="font-semibold">Test cards for the demo</p>
        <p className="mt-1 text-ink-soft"><span className="font-mono">4242 4242 4242 4242</span> pays · <span className="font-mono">4000 0000 0000 0002</span> is declined. Any future expiry and any CVC.</p>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={busy}><Lock size={17} /> Pay {formatMoney(amount)}</Button>
    </form>
  );
}

function GooglePaySheet({ amount, busy, onPay, onCancel }: { amount: number; busy: boolean; onPay: () => void; onCancel: () => void }) {
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-[#dadce0] bg-white text-[#202124] shadow-lift">
      <div className="flex items-center justify-between bg-[#f8f9fa] px-5 py-4"><PaymentLogo method="google_pay" large /><span className="text-xs text-[#5f6368]">Simulated</span></div>
      <div className="space-y-4 px-5 py-6">
        <div><p className="text-sm text-[#5f6368]">Pay Ride Easy Bike Rentals</p><p className="text-3xl font-bold">{formatMoney(amount)}</p></div>
        <div className="rounded-xl p-3 text-sm ring-1 ring-black/10"><p className="font-semibold">Visa •••• 4242</p><p className="text-[#5f6368]">Demo Google account</p></div>
        <button onClick={onPay} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-black font-bold text-white hover:bg-[#333] disabled:opacity-60">
          {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />} Pay
        </button>
        <button onClick={onCancel} disabled={busy} className="w-full rounded-full py-2 text-sm font-semibold text-[#1a73e8] hover:bg-black/5">Cancel</button>
      </div>
    </div>
  );
}
