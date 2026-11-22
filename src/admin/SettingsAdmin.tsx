import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, ConfirmDialog, Field, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { getSettings, resetDemoData, saveSettings } from "@/lib/api";
import { AdminTitle } from "./AdminLayout";

const num = (min: number, max: number) => z.coerce.number({ invalid_type_error: "Enter a number." }).min(min).max(max);
const schema = z.object({
  brand_name: z.string().trim().min(2, "Enter the brand name."),
  tagline: z.string().trim().max(80),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "Use a 3-letter code, e.g. USD."),
  delivery_fee: num(0, 500),
  return_time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time."),
  free_cancellation_hours: num(0, 720),
  booking_min_notice_hours_pickup: num(0, 168),
  booking_min_notice_hours_delivery: num(0, 168),
  contact_phone: z.string().trim().min(6, "Enter a phone number."),
  whatsapp: z.string().trim().regex(/^\+?[\d\s]{6,20}$/, "Use international format, e.g. +248 2 500 0000."),
  email: z.string().trim().email("Enter a valid email."),
  terms_text: z.string().trim().min(20, "Add your rental terms."),
});
type Values = z.infer<typeof schema>;

export default function SettingsAdmin() {
  const { data, loading } = useData(getSettings);
  const [saved, setSaved] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);
  if (loading) return <Skeleton className="h-[600px] max-w-3xl rounded-2xl" />;

  const f = (k: keyof Values, label: string, hint?: string, type = "text") => (
    <Field label={label} htmlFor={k} error={errors[k]?.message} hint={hint}><input id={k} type={type} step="any" className="field" {...register(k)} aria-invalid={!!errors[k]} /></Field>
  );

  return (
    <>
      <AdminTitle title="Settings">Business rules and text. Changes apply straight away; nothing is hard-coded.</AdminTitle>
      <form noValidate className="max-w-3xl space-y-6" onSubmit={handleSubmit(async (v) => { await saveSettings(v); reset(v); setSaved(true); setTimeout(() => setSaved(false), 2500); })}>
        <section className="card grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-lg font-semibold sm:col-span-2">Brand</h2>
          {f("brand_name", "Brand name", "Use “Name · sub-line”, e.g. Ride Easy · Bike Rentals")}
          {f("tagline", "Tagline")}
        </section>
        <section className="card grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-lg font-semibold sm:col-span-2">Rental rules</h2>
          {f("currency", "Currency", "Displayed with $ in this prototype")}
          {f("delivery_fee", "Delivery fee per booking", undefined, "number")}
          {f("return_time", "Return by (last day)", undefined, "time")}
          {f("free_cancellation_hours", "Free cancellation until (hours before start)", undefined, "number")}
          {f("booking_min_notice_hours_pickup", "Minimum notice for self-pickup (hours)", undefined, "number")}
          {f("booking_min_notice_hours_delivery", "Minimum notice for delivery (hours)", undefined, "number")}
        </section>
        <section className="card grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-lg font-semibold sm:col-span-2">Contact and terms</h2>
          {f("contact_phone", "Phone")}
          {f("whatsapp", "WhatsApp")}
          {f("email", "Email")}
          <div className="sm:col-span-2"><Field label="Rental terms" htmlFor="terms_text" error={errors.terms_text?.message} hint="Leave a blank line between paragraphs."><textarea id="terms_text" rows={10} className="field" {...register("terms_text")} /></Field></div>
        </section>
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>Save settings</Button>
          {saved && <span className="text-sm font-semibold text-status-available" role="status">Saved</span>}
        </div>
      </form>
      <section className="card mt-8 max-w-3xl p-6">
        <h2 className="text-lg font-semibold">Demo data</h2>
        <p className="mt-1 text-ink-soft">Put every bicycle, vendor, booking, discount and setting back to the original demo data.</p>
        <Alert tone="low" className="mt-4">Prototype data is stored in this browser only.</Alert>
        <Button variant="outline" className="mt-4" onClick={() => setResetOpen(true)}><RotateCcw size={17} /> Reset demo data</Button>
      </section>
      <ConfirmDialog open={resetOpen} onCancel={() => setResetOpen(false)} onConfirm={() => { resetDemoData(); setResetOpen(false); }} danger
        title="Reset all demo data?" confirmLabel="Reset everything" message="All changes to bicycles, vendors, bookings, discounts and settings will be replaced with the original demo data." />
    </>
  );
}
