import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Check, Lock, MapPin, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { DirectionsButton, MapView } from "@/components/MapView";
import { PaymentLogo } from "@/components/payment";
import { Alert, Button, Field, PageHeading, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, createBooking, getSettings, listHotels, listPickupPoints } from "@/lib/api";
import { cart } from "@/lib/cart";
import { DIAL_CODES, rememberBooking } from "@/lib/guest";
import { formatMoney } from "@/lib/money";
import { quoteCart } from "@/lib/pricing";
import { minNoticeError, withinOpeningHours } from "@/lib/rules";
import { TZ_LABEL, formatDate } from "@/lib/time";
import type { Hotel, PickupPoint, Settings } from "@/lib/types";
import { useCartData } from "./Cart";

function timeSlots(from: string, to: string) {
  const out: string[] = [];
  let [h, m] = from.split(":").map(Number);
  const [eh, em] = to.split(":").map(Number);
  while (h < eh || (h === eh && m <= em)) {
    out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 30;
    if (m >= 60) { h++; m -= 60; }
  }
  return out;
}

function makeSchema(s: Settings, pickups: PickupPoint[], hotels: Hotel[], startDate: string) {
  return z.object({
    guest_name: z.string().trim().min(2, "Please enter your full name."),
    dial: z.string().min(1),
    phone: z.string().trim().regex(/^[\d\s()-]{6,20}$/, "Please enter a valid phone number."),
    guest_email: z.string().trim().email("Please enter a valid email, e.g. you@example.com."),
    guest_passport: z.string().trim().regex(/^[A-Za-z0-9]{5,20}$/, "Enter your passport number (letters and numbers only)."),
    hotel: z.string().trim().min(2, "Tell us where you're staying."),
    room: z.string().trim().min(1, "Add your room number or name, e.g. 12 or Frangipani Suite.").max(40),
    fulfilment: z.enum(["pickup", "delivery"], { errorMap: () => ({ message: "Choose pickup or delivery." }) }),
    pickup_point_id: z.string(),
    time_needed: z.string().min(1, "Choose a time."),
    payment_method: z.enum(["card", "google_pay", "cash"]),
    agree: z.boolean().refine((v) => v, "Please agree to the rental terms to continue."),
  }).superRefine((v, ctx) => {
    if (v.fulfilment === "pickup") {
      const p = pickups.find((x) => x.id === v.pickup_point_id);
      if (!p) ctx.addIssue({ path: ["pickup_point_id"], code: "custom", message: "Choose a pickup point." });
      else if (v.time_needed && !withinOpeningHours(v.time_needed, p)) ctx.addIssue({ path: ["time_needed"], code: "custom", message: `${p.name} is open ${p.opens_at}–${p.closes_at}.` });
    }
    if (v.fulfilment === "delivery" && !hotels.some((h) => h.name === v.hotel) && v.hotel.trim().length < 2)
      ctx.addIssue({ path: ["hotel"], code: "custom", message: "Tell us the hotel name for delivery." });
    if (v.time_needed && v.fulfilment) {
      const err = minNoticeError(startDate, v.time_needed, v.fulfilment, s);
      if (err) ctx.addIssue({ path: ["time_needed"], code: "custom", message: err });
    }
  });
}
type Values = z.infer<ReturnType<typeof makeSchema>>;

const STEP_FIELDS: FieldPath<Values>[][] = [
  ["guest_name", "dial", "phone", "guest_email", "guest_passport", "hotel", "room"],
  ["fulfilment", "pickup_point_id", "time_needed"],
  ["payment_method", "agree"],
];
const STEPS = ["Your details", "Pickup or delivery", "Payment"];

export default function Checkout() {
  const { c, quote, problems, loading, data, dateError } = useCartData();
  const { data: refs } = useData(async () => {
    const [settings, pickups, hotels] = await Promise.all([getSettings(), listPickupPoints(), listHotels()]);
    return { settings, pickups, hotels };
  });
  if (c.lines.length === 0) return <Navigate to="/cart" replace />;
  if (loading || !data || !refs || !quote) return <div className="container-page grid gap-8 py-14 lg:grid-cols-[1.4fr_1fr]"><Skeleton className="h-[560px] rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></div>;
  if (problems.length || dateError) return <Navigate to="/cart" replace />;
  return <CheckoutForm refs={refs} />;
}

function CheckoutForm({ refs }: { refs: { settings: Settings; pickups: PickupPoint[]; hotels: Hotel[] } }) {
  const navigate = useNavigate();
  const { c, data, quote } = useCartData();
  const { settings, pickups, hotels } = refs;
  const [step, setStep] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const schema = useMemo(() => makeSchema(settings, pickups, hotels, c.start_date), [settings, pickups, hotels, c.start_date]);

  const { register, handleSubmit, watch, setValue, trigger, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema), mode: "onTouched",
    defaultValues: { guest_name: "", dial: "+44", phone: "", guest_email: "", guest_passport: "", hotel: "", room: "", fulfilment: undefined as unknown as "pickup", pickup_point_id: "", time_needed: "", payment_method: "card", agree: false },
  });
  const v = watch();
  const point = pickups.find((p) => p.id === v.pickup_point_id);
  const slots = v.fulfilment === "pickup" ? (point ? timeSlots(point.opens_at, point.closes_at) : []) : timeSlots("07:00", "18:00");
  const full = quote && data ? quoteCart(
    c.lines.map((l) => ({ listing: data.listings.find((x) => x.id === l.listing_id)!, quantity: l.quantity })),
    c.start_date, c.end_date, data.discounts, v.fulfilment ?? null, settings.delivery_fee) : null;

  async function next() {
    if (await trigger(STEP_FIELDS[step])) setStep((s) => s + 1);
  }

  async function onSubmit(values: Values) {
    setSubmitError(null);
    const hotel = hotels.find((h) => h.name.toLowerCase() === values.hotel.trim().toLowerCase());
    try {
      const { reference } = await createBooking({
        lines: c.lines, start_date: c.start_date, end_date: c.end_date,
        guest_name: values.guest_name, guest_phone: `${values.dial} ${values.phone}`, guest_email: values.guest_email, guest_passport: values.guest_passport,
        hotel_id: hotel?.id ?? null, hotel_other_name: hotel ? null : values.hotel.trim(), room: values.room,
        fulfilment: values.fulfilment, pickup_point_id: values.fulfilment === "pickup" ? values.pickup_point_id : null,
        time_needed: values.time_needed, payment_method: values.payment_method,
      });
      rememberBooking(reference, values.guest_email.trim().toLowerCase());
      cart.clear();
      navigate(values.payment_method === "cash" ? `/booking/${reference}` : `/pay/${reference}`);
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Something went wrong creating your booking. Please try again.");
    }
  }

  return (
    <div className="container-page py-10">
      <Link to="/cart" className="mb-6 inline-flex items-center gap-2 font-medium text-primary hover:underline"><ArrowLeft size={17} /> Back to cart</Link>
      <PageHeading eyebrow="Almost there" title="Checkout" />
      <ol className="mb-8 flex flex-wrap gap-2" aria-label="Checkout steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={clsx("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
            i === step ? "bg-primary text-primary-ink" : i < step ? "bg-tint text-ink" : "bg-surface text-ink-soft ring-1 ring-line")}>
            {i < step ? <Check size={15} aria-hidden /> : <span aria-hidden>{i + 1}</span>} {s}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid items-start gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6 sm:p-7">
          {step === 0 && (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Full name (lead guest)" htmlFor="guest_name" error={errors.guest_name?.message}>
                <input id="guest_name" className="field" autoComplete="name" {...register("guest_name")} aria-invalid={!!errors.guest_name} /></Field></div>
              <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
                <div className="flex gap-2">
                  <select aria-label="Country code" className="field w-28 shrink-0 px-2" {...register("dial")}>{DIAL_CODES.map((d) => <option key={d}>{d}</option>)}</select>
                  <input id="phone" type="tel" className="field" autoComplete="tel-national" {...register("phone")} aria-invalid={!!errors.phone} />
                </div>
              </Field>
              <Field label="Email" htmlFor="guest_email" error={errors.guest_email?.message} hint="We'll send your confirmation and PIN here.">
                <input id="guest_email" type="email" className="field" autoComplete="email" {...register("guest_email")} aria-invalid={!!errors.guest_email} /></Field>
              <div className="sm:col-span-2"><Field label="Passport number" htmlFor="guest_passport" error={errors.guest_passport?.message} hint="Needed for your rental agreement; stored securely.">
                <input id="guest_passport" className="field uppercase" autoComplete="off" {...register("guest_passport")} aria-invalid={!!errors.guest_passport} /></Field></div>
              <Field label="Hotel" htmlFor="hotel" error={errors.hotel?.message} hint="Start typing to search. Not on the list? Type its name.">
                <input id="hotel" className="field" list="hotel-list" autoComplete="off" {...register("hotel")} aria-invalid={!!errors.hotel} />
                <datalist id="hotel-list">{hotels.map((h) => <option key={h.id} value={h.name} />)}</datalist>
              </Field>
              <Field label="Room number or name" htmlFor="room" error={errors.room?.message} hint="e.g. 12 or Frangipani Suite">
                <input id="room" className="field" {...register("room")} aria-invalid={!!errors.room} /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div role="radiogroup" aria-label="Pickup or delivery" className="grid gap-4 sm:grid-cols-2">
                {([["pickup", MapPin, "Self-pickup", "Collect at a pickup point. Free."], ["delivery", Truck, "Delivery to your hotel", `${formatMoney(settings.delivery_fee)} per booking.`]] as const).map(([val, Icon, title, text]) => (
                  <label key={val} className={clsx("flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-5 transition", v.fulfilment === val ? "border-primary bg-tint/50" : "border-line hover:border-ink/30")}>
                    <input type="radio" value={val} className="sr-only" {...register("fulfilment", { onChange: () => setValue("time_needed", "") })} />
                    <Icon className="text-primary" size={26} aria-hidden />
                    <span className="text-lg font-semibold">{title}</span>
                    <span className="text-sm text-ink-soft">{text}</span>
                  </label>
                ))}
              </div>
              {errors.fulfilment && <p className="field-error">{errors.fulfilment.message}</p>}

              {v.fulfilment === "pickup" && (
                <div className="space-y-4">
                  <Field label="Pickup point" htmlFor="pickup_point_id" error={errors.pickup_point_id?.message}>
                    <select id="pickup_point_id" className="field" {...register("pickup_point_id", { onChange: () => setValue("time_needed", "") })}>
                      <option value="">Choose a pickup point</option>
                      {pickups.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </Field>
                  {point && (
                    <div className="space-y-3 rounded-xl border border-line p-4">
                      <p className="text-sm"><b>{point.address}</b> · open {point.opens_at}–{point.closes_at}</p>
                      <p className="text-sm text-ink-soft">{point.instructions}</p>
                      <MapView lat={point.latitude} lng={point.longitude} label={point.name} />
                      <DirectionsButton lat={point.latitude} lng={point.longitude} />
                    </div>
                  )}
                </div>
              )}
              {v.fulfilment === "delivery" && (
                <Alert tone="available">We'll deliver to <b>{v.hotel || "your hotel"}</b>, room {v.room || "—"}. Delivery fee {formatMoney(settings.delivery_fee)}. Return them at reception by {settings.return_time} on your last day.</Alert>
              )}
              {v.fulfilment && (v.fulfilment === "delivery" || point) && (
                <Field label={`${v.fulfilment === "pickup" ? "Collection" : "Delivery"} time on ${formatDate(c.start_date)} (${TZ_LABEL})`} htmlFor="time_needed" error={errors.time_needed?.message}
                  hint={`${v.fulfilment === "pickup" ? settings.booking_min_notice_hours_pickup : settings.booking_min_notice_hours_delivery} hours' notice needed.`}>
                  <select id="time_needed" className="field" {...register("time_needed")} aria-invalid={!!errors.time_needed}>
                    <option value="">Choose a time</option>
                    {slots.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div role="radiogroup" aria-label="Payment method" className="grid gap-3 sm:grid-cols-3">
                {([["card", "Card", "Visa, Mastercard, Amex"], ["google_pay", "Google Pay", "Fast checkout"], ["cash", "Cash at handover", "Pay when you collect"]] as const).map(([m, label, hint]) => (
                  <label key={m} className={clsx("flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition", v.payment_method === m ? "border-primary bg-tint/50" : "border-line hover:border-ink/30")}>
                    <input type="radio" value={m} className="sr-only" {...register("payment_method")} />
                    <PaymentLogo method={m} />
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-xs text-ink-soft">{hint}</span>
                  </label>
                ))}
              </div>
              <div>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-[rgb(var(--primary))]" {...register("agree")} aria-invalid={!!errors.agree} />
                  <span>I agree to the <Link to="/terms" target="_blank" className="link">rental terms</Link>.</span>
                </label>
                {errors.agree && <p className="field-error" role="alert">{errors.agree.message}</p>}
              </div>
              {submitError && <Alert>{submitError}</Alert>}
            </div>
          )}

          <div className="mt-8 flex justify-between gap-3 border-t border-line pt-6">
            {step > 0 ? <Button variant="outline" onClick={() => setStep((s) => s - 1)}><ArrowLeft size={17} /> Back</Button> : <span />}
            {step < 2 ? <Button variant="primary" onClick={next}>Continue <ArrowRight size={17} /></Button>
              : <Button type="submit" loading={isSubmitting}><Lock size={17} /> {v.payment_method === "cash" ? "Confirm booking" : "Continue to payment"}</Button>}
          </div>
        </div>

        <aside className="card p-6 lg:sticky lg:top-24">
          <h2 className="text-lg font-semibold">Order summary</h2>
          <p className="mt-1 text-sm text-ink-soft">{formatDate(c.start_date)} – {formatDate(c.end_date)} · {full?.days} {full?.days === 1 ? "day" : "days"}</p>
          <ul className="mt-4 space-y-3 text-sm">
            {full?.lines.map((l) => <li key={l.listing_id} className="flex justify-between gap-3"><span className="text-ink-soft">{l.breakdown}</span><b className="shrink-0">{formatMoney(l.line_total)}</b></li>)}
          </ul>
          {full && (
            <dl className="mt-4 space-y-2 border-t border-line pt-4">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(full.subtotal)}</dd></div>
              {full.discount_total > 0 && <div className="flex justify-between text-status-available"><dt>Discounts</dt><dd>−{formatMoney(full.discount_total)}</dd></div>}
              {full.delivery_fee > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatMoney(full.delivery_fee)}</dd></div>}
              <div className="flex items-baseline justify-between border-t border-line pt-3"><dt className="text-xl font-bold">Total</dt><dd className="text-2xl font-bold">{formatMoney(full.total)}</dd></div>
            </dl>
          )}
          <p className="mt-3 text-xs text-ink-soft">Card and Google Pay bookings are held for 15 minutes while you pay.</p>
        </aside>
      </form>
    </div>
  );
}
