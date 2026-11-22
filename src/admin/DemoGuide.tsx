import { CheckCircle2, Clock, ExternalLink, HelpCircle, Palette, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useData } from "@/hooks/useData";
import { getSettings } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { AdminTitle } from "./AdminLayout";

type Step = { step: string; detail: string; to?: string };

const SCRIPT: { title: string; steps: Step[] }[] = [
  { title: "1. Tourist: cart, delivery, cash (≈2 min)", steps: [
    { step: "Home → pick dates", detail: "Show “Priced per day — collect any time on your first day” and the live Festive banner.", to: "/" },
    { step: "Add 2 × Women's city bike + 1 × Children's 20\" bike", detail: "Open each bicycle, choose quantity, Add to cart. Point out the crossed-out price and per-day discount breakdown.", to: "/bicycles" },
    { step: "Cart", detail: "One set of dates for all bicycles. Change the dates to show every line being re-checked.", to: "/cart" },
    { step: "Checkout with delivery, pay cash", detail: "Pick a hotel from the list, delivery adds the fee, choose a time (12 h notice), Cash at handover." },
    { step: "Confirmation", detail: "Reference, large PIN card, “Cash due at handover”, return-by time." },
  ] },
  { title: "2. Second tourist: self-pickup, card (≈1 min)", steps: [
    { step: "Self-pickup", detail: "Choose La Passe Jetty Kiosk: map, opening hours, Get directions." },
    { step: "Pay by card 4242 4242 4242 4242", detail: "Show the 15-minute hold timer. 4000 0000 0000 0002 shows a decline with “Pay cash instead”." },
  ] },
  { title: "3. Admin: assign vendors (≈1 min)", steps: [
    { step: "Open the new booking", detail: "Assign a vendor per bicycle; the commission rate is stored on the booking.", to: "/admin/bookings" },
    { step: "Today view", detail: "Handovers, returns and “needs a vendor”.", to: "/admin" },
  ] },
  { title: "4–5. Staff on a phone (≈2 min)", steps: [
    { step: "Sign in as staff@demo.test", detail: "Open today's pickup. Enter a wrong PIN (attempts left), then the right PIN.", to: "/staff" },
    { step: "Record bicycle numbers + vendor, collect cash", detail: "Try a number that's already out to show the duplicate check. Complete handover." },
    { step: "Record the return", detail: "Condition chips per bicycle, late-return warning, Complete return." },
  ] },
  { title: "6. Admin: reports and a new discount (≈1 min)", steps: [
    { step: "Reports → By vendor → Vendor statement", detail: "Commission and net payable per vendor. Export CSV, Print.", to: "/admin/reports" },
    { step: "Create a seasonal discount", detail: "Read the plain-English preview, make it live today, then show it on the home page.", to: "/admin/discounts" },
  ] },
];

const SIMULATED = ["Payments and refunds (card and Google Pay screens are mock-ups)", "Emails (stored under Sent emails, not sent)", "Multiple languages", "Live delivery tracking",
  "Vendor self-service portal", "The mobile app (pricing, availability and booking rules are already in reusable modules)", "Hosted database and real sign-in (demo data lives in this browser; reset it in Settings)"];

export default function DemoGuide() {
  const { data: s } = useData(getSettings);
  const decisions: [string, string][] = [
    ["Q1 · What do tourists book?", "A bicycle type (e.g. “Women's city bike”). The admin assigns a vendor to each booked bicycle later."],
    ["Q2 · Where is self-pickup?", "At pickup points the admin manages (2 in the demo)."],
    ["Q3 · Who does the handover?", "Anyone with the Handover staff role — hotel or vendor staff."],
    ["Q4 · Who takes the money?", "Tourists pay the platform; the platform pays each vendor the rental minus commission."],
    ["Q5 · How is commission set?", "Per vendor: a % of the rental price, or a fixed amount per bike per day."],
    ["Q6 · Return time?", `By ${s?.return_time ?? "18:00"} on the last day (setting).`],
    ["Q7 · Delivery?", `${s ? formatMoney(s.delivery_fee) : "$5"} per booking (setting), only to listed hotels or a typed-in “other” hotel.`],
    ["Q8 · Cancellation?", `Free until ${s?.free_cancellation_hours ?? 24} hours before the start (setting); later it can't be cancelled online.`],
    ["Q9 · Currency?", `${s?.currency ?? "USD"} (setting), shown with $.`],
    ["Q11 · Passport?", "Collected at checkout; masked everywhere except the admin booking detail and the staff handover screen."],
  ];

  return (
    <div className="max-w-5xl">
      <AdminTitle title="Demo guide"><span className="inline-flex items-center gap-1.5"><Clock size={16} aria-hidden /> A 7-minute walkthrough, plus the decisions we need from you.</span></AdminTitle>
      <section className="card mb-6 flex gap-4 p-5">
        <Palette className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <p className="text-ink-soft">Use the <b>Palette</b> button to show the site in Coastal Ride, Island Trail or Sunrise Pedal — each matches one of the hotel website palettes. Demo logins: <span className="font-mono">admin@demo.test</span> and <span className="font-mono">staff@demo.test</span>, password <span className="font-mono">Demo@2026</span>.</p>
      </section>

      <h2 className="mb-3 text-2xl font-semibold">A. Demo script</h2>
      <div className="grid gap-5 lg:grid-cols-2">
        {SCRIPT.map((part) => (
          <section key={part.title} className="card p-5">
            <h3 className="font-semibold">{part.title}</h3>
            <ol className="mt-3 space-y-3">
              {part.steps.map((st) => (
                <li key={st.step}>
                  <p className="font-medium">{st.step}{st.to && <Link to={st.to} target={st.to.startsWith("/admin") ? undefined : "_blank"} className="ml-2 inline-flex items-center gap-1 text-sm text-primary hover:underline">open <ExternalLink size={12} /></Link>}</p>
                  <p className="text-sm text-ink-soft">{st.detail}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <h2 className="mb-3 mt-10 flex items-center gap-2 text-2xl font-semibold"><HelpCircle className="text-primary" aria-hidden /> B. Decisions we need from you</h2>
      <p className="mb-4 text-ink-soft">The SRS has open questions. The prototype works with the recommended answer for each, so you can confirm or change them during the demo.</p>
      <div className="card divide-y divide-line">
        {decisions.map(([q, a]) => <div key={q} className="grid gap-1 p-4 sm:grid-cols-[260px_1fr]"><p className="font-semibold">{q}</p><p className="text-ink-soft">Prototype assumes: {a}</p></div>)}
        <div className="p-4 text-sm text-ink-soft">Q10 and Q12–Q14: listed in the SRS; this prototype doesn't depend on them yet, so please review them with us from the document.</div>
      </div>

      <section className="card mt-10 grid gap-6 p-6 md:grid-cols-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><XCircle size={19} className="text-status-overdue" aria-hidden /> C. Simulated in this prototype</h2>
          <ul className="mt-3 space-y-2 text-ink-soft">{SIMULATED.map((x) => <li key={x} className="flex gap-2"><span aria-hidden>•</span>{x}</li>)}</ul>
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 size={19} className="text-status-available" aria-hidden /> Working rules</h2>
          <ul className="mt-3 space-y-2 text-ink-soft">
            {["Per-calendar-day pricing with per-day seasonal discounts (best one wins)", "Daily supply limits checked on every rental day", "Cart with one set of dates, pickup or delivery", "PIN at handover, locked after 5 wrong tries",
              "Bicycle numbers recorded at handover, duplicates blocked", "Commission snapshot per bicycle, vendor statements and CSV export", "Audit log of handovers, returns, payments, cancellations, vendors and prices"].map((x) => <li key={x} className="flex gap-2"><span aria-hidden>•</span>{x}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
