import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Tag } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Badge, Button, EmptyState, Field, Sheet, Skeleton, Toggle } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, adminData, saveDiscount } from "@/lib/api";
import { describeDiscount, discountLabel } from "@/lib/pricing";
import { discountStatus, type DiscountStatus } from "@/lib/reports";
import { addDays, formatDate, scDate } from "@/lib/time";
import type { Category, Discount, Listing } from "@/lib/types";
import { AdminTitle, Table } from "./AdminLayout";

const TONE: Record<DiscountStatus, "available" | "low" | "booked" | "outline"> = { Live: "available", Scheduled: "low", Expired: "booked", Inactive: "outline" };

const schema = z.object({
  name: z.string().trim().min(2, "Give the discount a name."),
  discount_type: z.enum(["percentage", "fixed_per_day"]),
  value: z.coerce.number({ invalid_type_error: "Enter a value." }).positive("Must be more than 0."),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an end date."),
  scope: z.enum(["all", "categories", "listings"]),
  category_ids: z.array(z.string()),
  listing_ids: z.array(z.string()),
  is_active: z.boolean(),
})
  .refine((v) => v.ends_on >= v.starts_on, { path: ["ends_on"], message: "End date must be on or after the start date." })
  .refine((v) => v.discount_type !== "percentage" || v.value <= 100, { path: ["value"], message: "A percentage can't be over 100." })
  .refine((v) => v.scope !== "categories" || v.category_ids.length > 0, { path: ["category_ids"], message: "Choose at least one category." })
  .refine((v) => v.scope !== "listings" || v.listing_ids.length > 0, { path: ["listing_ids"], message: "Choose at least one bicycle." });
type Values = z.infer<typeof schema>;

function Checklist({ items, value, onChange }: { items: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="mt-2 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
      {items.map((x) => (
        <label key={x.id} className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--re-primary))]" checked={value.includes(x.id)} onChange={(e) => onChange(e.target.checked ? [...value, x.id] : value.filter((y) => y !== x.id))} />{x.name}
        </label>
      ))}
    </div>
  );
}

function DiscountForm({ discount, categories, listings, onDone }: { discount?: Discount; categories: Category[]; listings: Listing[]; onDone: () => void }) {
  const today = scDate(new Date());
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: discount ?? { name: "", discount_type: "percentage", value: 10, starts_on: today, ends_on: addDays(today, 30), scope: "all", category_ids: [], listing_ids: [], is_active: true },
  });
  const v = watch();
  const names = { categories: Object.fromEntries(categories.map((c) => [c.id, c.name])), listings: Object.fromEntries(listings.map((l) => [l.id, l.name])) };
  return (
    <form noValidate className="space-y-5" onSubmit={handleSubmit(async (vals) => {
      try { await saveDiscount({ ...vals, id: discount?.id }); onDone(); } catch (e) { setError(e instanceof ApiError ? e.message : "Couldn't save."); }
    })}>
      <div className="rounded-xl bg-tint/60 p-4" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Preview</p>
        <p className="mt-1 font-semibold">{describeDiscount({ ...v, value: Number(v.value) || 0 }, names)}</p>
        <p className="mt-1 text-xs text-ink-soft">Applies to each rental day inside the dates. If several discounts match a day, only the best one counts.</p>
      </div>
      <Field label="Name" htmlFor="dn" error={errors.name?.message}><input id="dn" className="field" {...register("name")} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type" htmlFor="dt"><select id="dt" className="field" {...register("discount_type")}><option value="percentage">Percentage (%)</option><option value="fixed_per_day">$ off per bike per day</option></select></Field>
        <Field label="Value" htmlFor="dv" error={errors.value?.message}><input id="dv" type="number" step="0.5" className="field" {...register("value")} /></Field>
        <Field label="Starts" htmlFor="ds" error={errors.starts_on?.message}><input id="ds" type="date" className="field" {...register("starts_on")} /></Field>
        <Field label="Ends" htmlFor="de" error={errors.ends_on?.message}><input id="de" type="date" className="field" {...register("ends_on")} /></Field>
      </div>
      <fieldset>
        <legend className="field-label">Applies to</legend>
        <div className="flex flex-wrap gap-5">
          {([["all", "All bicycles"], ["categories", "Chosen categories"], ["listings", "Chosen bicycles"]] as const).map(([val, l]) => (
            <label key={val} className="inline-flex items-center gap-2"><input type="radio" value={val} className="accent-[rgb(var(--re-primary))]" {...register("scope")} /> {l}</label>
          ))}
        </div>
        {v.scope === "categories" && <Controller control={control} name="category_ids" render={({ field }) => <Checklist items={categories} value={field.value} onChange={field.onChange} />} />}
        {v.scope === "listings" && <Controller control={control} name="listing_ids" render={({ field }) => <Checklist items={listings} value={field.value} onChange={field.onChange} />} />}
        {(errors.category_ids || errors.listing_ids) && <p className="field-error">{errors.category_ids?.message ?? errors.listing_ids?.message}</p>}
      </fieldset>
      <Controller control={control} name="is_active" render={({ field }) => <Toggle label="Active" checked={field.value} onChange={field.onChange} />} />
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2 border-t border-line pt-5"><Button variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" variant="primary" loading={isSubmitting}>Save discount</Button></div>
    </form>
  );
}

export default function DiscountsAdmin() {
  const { data, loading } = useData(adminData);
  const [editing, setEditing] = useState<Discount | "new" | null>(null);
  const names = data ? { categories: Object.fromEntries(data.categories.map((c) => [c.id, c.name])), listings: Object.fromEntries(data.listings.map((l) => [l.id, l.name])) } : null;
  return (
    <>
      <AdminTitle title="Seasonal discounts" actions={<Button onClick={() => setEditing("new")}><Plus size={18} /> New discount</Button>}>Applied automatically per rental day. Only the single best discount counts per bicycle per day.</AdminTitle>
      {loading || !data || !names ? <Skeleton className="h-64 rounded-2xl" />
        : data.discounts.length === 0 ? <EmptyState icon={<Tag />} title="No discounts yet" action={<Button onClick={() => setEditing("new")}>Create a discount</Button>} />
        : (
          <Table head={["Discount", "Amount", "Dates", "Status", ""]}>
            {[...data.discounts].sort((a, b) => b.starts_on.localeCompare(a.starts_on)).map((d) => {
              const st = discountStatus(d);
              return (
                <tr key={d.id} className="hover:bg-tint/20">
                  <td className="px-4 py-3"><p className="font-semibold">{d.name}</p><p className="text-ink-soft">{describeDiscount(d, names).split(",")[0]}</p></td>
                  <td className="px-4 py-3 font-semibold">{discountLabel(d)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(d.starts_on)} – {formatDate(d.ends_on)}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[st]}>{st}</Badge></td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing(d)}><Pencil size={15} /> Edit</Button></td>
                </tr>
              );
            })}
          </Table>
        )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "New discount" : "Edit discount"}>
        {editing && data && <DiscountForm key={editing === "new" ? "new" : editing.id} discount={editing === "new" ? undefined : editing} categories={data.categories} listings={data.listings} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}
