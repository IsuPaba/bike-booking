import clsx from "clsx";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, recordReturn, staffGetBooking, staffLookups } from "@/lib/api";
import { returnDeadline } from "@/lib/rules";
import { formatDate, formatDateTime, fromLocalInput, toLocalInput } from "@/lib/time";

const CHIPS = ["Good", "Scratched", "Flat tyre", "Damaged"];

export default function StaffReturn() {
  const { id = "" } = useParams();
  const { data, loading } = useData(async () => ({ b: await staffGetBooking(id), lookups: await staffLookups() }), [id]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [returnedAt, setReturnedAt] = useState(toLocalInput(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (data?.b) setNotes((n) => (Object.keys(n).length ? n : Object.fromEntries(data.b!.items.map((i) => [i.id, "Good"]))));
  }, [data]);

  if (loading) return <Skeleton className="h-96 rounded-2xl" />;
  const b = data?.b;
  if (!b || !data) return <EmptyState title="Booking not found" action={<ButtonLink to="/staff">Back to today</ButtonLink>} />;
  const iso = fromLocalInput(returnedAt);
  const late = iso && new Date(iso) > new Date(returnDeadline(b.end_date, data.lookups.return_time));
  const name = (lid: string) => data.lookups.listings.find((l) => l.id === lid)?.name ?? "Bicycle";

  async function complete() {
    if (!iso) return setError("Enter the return time.");
    setSaving(true);
    setError(null);
    try {
      await recordReturn(b!.id, Object.entries(notes).map(([item_id, condition_notes]) => ({ item_id, condition_notes })), iso);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't record the return.");
    } finally {
      setSaving(false);
    }
  }

  if (done) return (
    <div className="py-10 text-center">
      <CheckCircle2 size={72} className="mx-auto text-status-available" aria-hidden />
      <h1 className="h-display mt-4 text-5xl text-status-available">Returned</h1>
      <p className="mt-2 text-lg text-ink-soft">{b.reference} is complete.</p>
      <ButtonLink to="/staff" size="lg" className="mt-8">Back to today</ButtonLink>
    </div>
  );

  return (
    <div className="space-y-5">
      <Link to="/staff" className="inline-flex h-11 items-center gap-2 font-semibold text-primary"><ArrowLeft size={18} /> Today</Link>
      <section className="card p-5">
        <p className="font-mono text-xl font-bold">{b.reference}</p>
        <h1 className="mt-1 text-2xl font-bold">Return · {b.guest_name}</h1>
        <p className="text-ink-soft">Due {formatDate(b.end_date)} by {data.lookups.return_time}{b.handed_over_at ? ` · out since ${formatDateTime(b.handed_over_at)}` : ""}</p>
      </section>
      {b.status !== "with_tourist" ? <Alert tone="low">This booking isn't out with the guest, so there's nothing to return.</Alert> : (
        <>
          <section className="card space-y-4 p-5">
            {b.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-line p-4">
                <p className="font-semibold">{name(item.listing_id)} · <span className="font-mono">#{item.bicycle_number}</span></p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Condition">
                  {CHIPS.map((c) => (
                    <button key={c} onClick={() => setNotes((n) => ({ ...n, [item.id]: c }))} aria-pressed={notes[item.id] === c}
                      className={clsx("h-11 rounded-full px-4 text-sm font-semibold ring-1", notes[item.id] === c ? "bg-primary text-primary-ink ring-primary" : "bg-surface ring-line")}>{c}</button>
                  ))}
                </div>
                <input className="field mt-3" placeholder="Other notes (optional)" aria-label={`Condition notes for bicycle ${item.bicycle_number}`}
                  value={CHIPS.includes(notes[item.id] ?? "") ? "" : notes[item.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [item.id]: e.target.value }))} />
              </div>
            ))}
          </section>
          <section className="card p-5">
            <label className="field-label" htmlFor="ret">Returned at (Seychelles time)</label>
            <input id="ret" type="datetime-local" className="field h-14 text-lg" value={returnedAt} onChange={(e) => setReturnedAt(e.target.value)} />
            {late && <p className="mt-3 flex items-center gap-2 rounded-xl bg-status-overdue-bg px-3 py-2 font-semibold text-status-overdue"><AlertTriangle size={18} aria-hidden /> Late return — due by {data.lookups.return_time} on {formatDate(b.end_date)}</p>}
          </section>
          {error && <Alert>{error}</Alert>}
          <Button size="lg" className="h-16 w-full text-lg" loading={saving} onClick={complete}>Complete return</Button>
        </>
      )}
    </div>
  );
}
