import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { StatusBadge } from "@/components/booking";
import { Alert, Badge, Button, EmptyState, Field, Sheet, Skeleton, Toggle } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, adminData, saveVendor } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { commissionLabel } from "@/lib/pricing";
import { byVendor } from "@/lib/reports";
import { addDays, formatDate, scDate } from "@/lib/time";
import type { Vendor } from "@/lib/types";
import { AdminTitle, Table } from "./AdminLayout";

const schema = z.object({
  business_name: z.string().trim().min(2, "Enter the business name."),
  contact_person: z.string().trim().min(2, "Enter a contact person."),
  phone: z.string().trim().min(6, "Enter a phone number."),
  email: z.string().trim().email("Enter a valid email."),
  location_text: z.string().trim().max(120),
  commission_type: z.enum(["percentage", "fixed_per_bike_day"]),
  commission_value: z.coerce.number({ invalid_type_error: "Enter a value." }).min(0),
  is_active: z.boolean(),
  notes: z.string().trim().max(500),
}).refine((v) => v.commission_type !== "percentage" || v.commission_value <= 100, { path: ["commission_value"], message: "A percentage can't be over 100." });
type Values = z.infer<typeof schema>;

function VendorForm({ vendor, onDone }: { vendor?: Vendor; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: vendor ?? { business_name: "", contact_person: "", phone: "", email: "", location_text: "", commission_type: "percentage", commission_value: 15, is_active: true, notes: "" },
  });
  return (
    <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
      try { await saveVendor({ ...v, id: vendor?.id }); onDone(); } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't save."); }
    })}>
      <Field label="Business name" htmlFor="vb" error={errors.business_name?.message}><input id="vb" className="field" {...register("business_name")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact person" htmlFor="vc" error={errors.contact_person?.message}><input id="vc" className="field" {...register("contact_person")} /></Field>
        <Field label="Phone" htmlFor="vp" error={errors.phone?.message}><input id="vp" className="field" {...register("phone")} /></Field>
        <Field label="Email" htmlFor="ve" error={errors.email?.message}><input id="ve" className="field" {...register("email")} /></Field>
        <Field label="Location" htmlFor="vl"><input id="vl" className="field" {...register("location_text")} /></Field>
        <Field label="Commission type" htmlFor="vt"><select id="vt" className="field" {...register("commission_type")}><option value="percentage">% of rental price</option><option value="fixed_per_bike_day">Fixed $ per bike per day</option></select></Field>
        <Field label={watch("commission_type") === "percentage" ? "Commission (%)" : "Commission ($ per bike-day)"} htmlFor="vv" error={errors.commission_value?.message}><input id="vv" type="number" step="0.5" className="field" {...register("commission_value")} /></Field>
      </div>
      <p className="text-sm text-ink-soft">Changing the rate only affects bicycles assigned from now on. Past bookings keep the rate they were assigned with.</p>
      <Field label="Notes" htmlFor="vn"><textarea id="vn" rows={3} className="field" {...register("notes")} /></Field>
      <Controller control={control} name="is_active" render={({ field }) => <Toggle label="Active" checked={field.value} onChange={field.onChange} />} />
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" variant="primary" loading={isSubmitting}>Save vendor</Button></div>
    </form>
  );
}

export default function VendorsAdmin() {
  const { data, loading } = useData(adminData);
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const today = scDate(new Date());
  const month = data ? byVendor(data.bookings, data.vendors, addDays(today, -29), today) : [];
  return (
    <>
      <AdminTitle title="Vendors" actions={<Button onClick={() => setEditing("new")}><Plus size={18} /> Add vendor</Button>}>Rental companies that supply the bicycles, and the commission you earn from each.</AdminTitle>
      {loading || !data ? <Skeleton className="h-64 rounded-2xl" /> : data.vendors.length === 0 ? <EmptyState title="No vendors yet" /> : (
        <Table head={["Vendor", "Contact", "Commission", "Last 30 days", "Status", ""]}>
          {data.vendors.map((v) => {
            const m = month.find((r) => r.vendorId === v.id);
            return (
              <tr key={v.id} className="hover:bg-tint/20">
                <td className="px-4 py-3"><Link to={`/admin/vendors/${v.id}`} className="font-semibold text-primary hover:underline">{v.business_name}</Link><p className="text-ink-soft">{v.location_text}</p></td>
                <td className="px-4 py-3">{v.contact_person}<p className="text-ink-soft">{v.phone}</p></td>
                <td className="px-4 py-3">{commissionLabel(v.commission_type, v.commission_value)}</td>
                <td className="px-4 py-3">{m?.bicycles ?? 0} bicycles · {formatMoney(m?.commission ?? 0)} commission</td>
                <td className="px-4 py-3"><Badge tone={v.is_active ? "available" : "outline"}>{v.is_active ? "Active" : "Inactive"}</Badge></td>
                <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(v)}><Pencil size={15} /> Edit</Button></td>
              </tr>
            );
          })}
        </Table>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New vendor" : "Edit vendor"}>
        {editing && <VendorForm key={editing === "new" ? "new" : editing.id} vendor={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}

export function VendorDetail() {
  const { id = "" } = useParams();
  const { data, loading } = useData(adminData);
  if (loading || !data) return <Skeleton className="h-96 rounded-2xl" />;
  const v = data.vendors.find((x) => x.id === id);
  if (!v) return <EmptyState title="Vendor not found" />;
  const rentals = data.bookings.flatMap((b) => b.items.filter((i) => i.vendor_id === id).map((i) => ({ b, i }))).sort((x, y) => y.b.start_date.localeCompare(x.b.start_date));
  return (
    <>
      <Link to="/admin/vendors" className="mb-4 inline-flex items-center gap-2 font-medium text-primary hover:underline"><ArrowLeft size={17} /> All vendors</Link>
      <AdminTitle title={v.business_name} actions={<Link to={`/admin/reports?vendor=${v.id}`} className="font-semibold text-primary hover:underline">Vendor statement →</Link>}>
        {v.contact_person} · {v.phone} · {v.email} · commission {commissionLabel(v.commission_type, v.commission_value)}
      </AdminTitle>
      {rentals.length === 0 ? <EmptyState title="No rentals yet">Assign this vendor to booked bicycles from a booking's detail page.</EmptyState> : (
        <Table minWidth={880} head={["Booking", "Dates", "Bicycle", "Number", "Rental", "Commission", "Status"]}>
          {rentals.map(({ b, i }) => (
            <tr key={i.id}>
              <td className="px-4 py-3"><Link to={`/admin/bookings/${b.id}`} className="font-mono font-semibold text-primary hover:underline">{b.reference}</Link></td>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(b.start_date)} – {formatDate(b.end_date)}</td>
              <td className="px-4 py-3">{data.listings.find((l) => l.id === i.listing_id)?.name}</td>
              <td className="px-4 py-3 font-mono">{i.bicycle_number ?? "—"}</td>
              <td className="px-4 py-3">{formatMoney(i.line_total)}</td>
              <td className="px-4 py-3">{formatMoney(i.commission_amount ?? 0)}<p className="text-xs text-ink-soft">{i.commission_type && commissionLabel(i.commission_type, i.commission_value!)}</p></td>
              <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
