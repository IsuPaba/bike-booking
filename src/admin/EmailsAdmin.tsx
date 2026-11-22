import { Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { adminData } from "@/lib/api";
import { formatDateTime } from "@/lib/time";
import { AdminTitle } from "./AdminLayout";

/** Simulated email outbox: nothing is really sent. */
export default function EmailsAdmin() {
  const { data, loading } = useData(adminData);
  const [kind, setKind] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  if (loading || !data) return <Skeleton className="h-96 rounded-2xl" />;
  const emails = [...data.email_outbox].filter((e) => !kind || e.kind === kind).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const current = emails.find((e) => e.id === selected) ?? emails[0];
  const booking = current && data.bookings.find((b) => b.id === current.booking_id);

  return (
    <>
      <AdminTitle title="Sent emails" actions={
        <select className="field" aria-label="Email type" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All emails</option><option value="confirmation">Confirmations</option><option value="receipt">Receipts</option><option value="cancellation">Cancellations</option>
        </select>}>Prototype: emails are stored here instead of being sent.</AdminTitle>
      {emails.length === 0 ? <EmptyState icon={<Mail />} title="No emails yet" /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <ul className="card max-h-[70vh] divide-y divide-line overflow-y-auto">
            {emails.map((e) => (
              <li key={e.id}>
                <button onClick={() => setSelected(e.id)} className={`w-full px-4 py-3 text-left hover:bg-tint/30 ${current?.id === e.id ? "bg-tint/50" : ""}`}>
                  <div className="flex items-center justify-between gap-2"><p className="truncate font-semibold">{e.subject}</p><Badge tone={e.kind === "cancellation" ? "overdue" : e.kind === "receipt" ? "available" : "tint"}>{e.kind}</Badge></div>
                  <p className="truncate text-sm text-ink-soft">{e.to_email} · {formatDateTime(e.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
          {current && (
            <section className="card p-5" aria-label="Email preview">
              <p className="text-sm text-ink-soft">To {current.to_email} · {formatDateTime(current.created_at)}</p>
              {booking && <Link to={`/admin/bookings/${booking.id}`} className="text-sm font-semibold text-primary hover:underline">Open booking {booking.reference}</Link>}
              {/* Our own generated, escaped template */}
              <div className="mt-4 rounded-xl bg-white p-5 ring-1 ring-line" dangerouslySetInnerHTML={{ __html: current.body_html }} />
            </section>
          )}
        </div>
      )}
    </>
  );
}
