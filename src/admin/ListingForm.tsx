import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, GripVertical, ImagePlus, Star, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { Alert, Button, Field, Skeleton, Toggle } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, adminData, saveListing } from "@/lib/api";
import NotFound from "@/pages/NotFound";

const schema = z.object({
  name: z.string().trim().min(2, "Give the bicycle a name."),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only."),
  category_id: z.string().min(1, "Choose a category."),
  bike_type: z.enum(["standard", "electric"]),
  short_description: z.string().trim().min(5, "Add a one-line description.").max(120),
  description: z.string().trim().max(1200),
  features: z.array(z.string()).max(8, "Up to 8 features."),
  rider_height_min_cm: z.coerce.number().int().min(80).max(220),
  rider_height_max_cm: z.coerce.number().int().min(80).max(230),
  daily_price: z.coerce.number({ invalid_type_error: "Enter a price." }).min(1, "At least $1.").max(1000),
  daily_limit: z.coerce.number({ invalid_type_error: "Enter a number." }).int().min(0).max(500),
  is_active: z.boolean(),
  is_featured: z.boolean(),
}).refine((v) => v.rider_height_max_cm > v.rider_height_min_cm, { path: ["rider_height_max_cm"], message: "Must be taller than the minimum." });
type Values = z.infer<typeof schema>;
type Photo = { storage_path: string; is_primary: boolean };

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Resize an uploaded photo in the browser so it fits in local storage. */
function compress(file: File, max = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => reject(new Error("That file isn't an image we can read."));
    img.src = URL.createObjectURL(file);
  });
}

function Chips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const f = draft.trim();
    if (f && !value.includes(f)) onChange([...value, f]);
    setDraft("");
  };
  return (
    <div className="field flex flex-wrap items-center gap-2 py-2">
      {value.map((f) => <span key={f} className="inline-flex items-center gap-1 rounded-md bg-tint px-2.5 py-1 text-sm font-medium">{f}<button type="button" onClick={() => onChange(value.filter((x) => x !== f))} aria-label={`Remove ${f}`}><X size={14} /></button></span>)}
      <input id="features" value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={add} placeholder={value.length ? "Add another…" : "e.g. Front basket, then Enter"} className="min-w-[160px] flex-1 bg-transparent py-1 outline-none"
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} />
    </div>
  );
}

function Photos({ photos, onChange }: { photos: Photo[]; onChange: (p: Photo[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length || from === to) return;
    const next = [...photos];
    next.splice(to, 0, ...next.splice(from, 1));
    onChange(next);
  };
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try {
      const added = await Promise.all([...files].map((f) => compress(f)));
      const next = [...photos, ...added.map((storage_path) => ({ storage_path, is_primary: false }))];
      if (!next.some((p) => p.is_primary)) next[0] = { ...next[0], is_primary: true };
      onChange(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
    if (ref.current) ref.current.value = "";
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p, i) => (
          <div key={p.storage_path + i} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null); }}
            className={`relative overflow-hidden rounded-xl border-2 bg-tint ${p.is_primary ? "border-primary" : "border-transparent"}`}>
            <img src={p.storage_path} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover mix-blend-multiply" />
            <span className="absolute left-2 top-2 grid h-7 w-7 cursor-grab place-items-center rounded-md bg-surface/90 text-ink-soft" aria-hidden><GripVertical size={15} /></span>
            {p.is_primary && <span className="absolute right-2 top-2 rounded-md bg-primary px-2 py-0.5 text-xs font-semibold text-primary-ink">Main photo</span>}
            <div className="flex flex-wrap gap-1 bg-surface p-1.5 text-xs font-semibold">
              {!p.is_primary && <button type="button" className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-tint" onClick={() => onChange(photos.map((x, j) => ({ ...x, is_primary: j === i })))}><Star size={13} /> Set as main</button>}
              <button type="button" className="rounded-md px-2 py-1 hover:bg-tint" onClick={() => move(i, i - 1)} aria-label="Move earlier">←</button>
              <button type="button" className="rounded-md px-2 py-1 hover:bg-tint" onClick={() => move(i, i + 1)} aria-label="Move later">→</button>
              <button type="button" className="ml-auto rounded-md px-2 py-1 text-status-overdue hover:bg-status-overdue-bg" aria-label={`Remove photo ${i + 1}`}
                onClick={() => { const next = photos.filter((_, j) => j !== i); if (p.is_primary && next[0]) next[0] = { ...next[0], is_primary: true }; onChange(next); }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => ref.current?.click()} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line text-ink-soft hover:border-primary hover:text-primary">
          <ImagePlus size={26} aria-hidden /><span className="text-sm font-semibold">Add photos</span>
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files)} aria-label="Upload bicycle photos" />
      <p className="mt-2 text-xs text-ink-soft">Drag to reorder. Prototype: photos are stored in this browser.</p>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

const EMPTY: Values = { name: "", slug: "", category_id: "", bike_type: "standard", short_description: "", description: "", features: [], rider_height_min_cm: 150, rider_height_max_cm: 190, daily_price: 12, daily_limit: 5, is_active: true, is_featured: false };

export default function ListingForm() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const { data, loading } = useData(adminData);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const listing = data?.listings.find((l) => l.id === id);

  useEffect(() => {
    if (!data) return;
    if (listing) {
      const { id: _i, sort_order: _s, ...rest } = listing;
      reset(rest);
      setPhotos(data.listing_images.filter((i) => i.listing_id === listing.id).sort((a, b) => a.sort_order - b.sort_order).map((i) => ({ storage_path: i.storage_path, is_primary: i.is_primary })));
    } else if (isNew) reset({ ...EMPTY, category_id: data.categories[0]?.id ?? "" });
    // Only when the record changes, not on every refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id, isNew, !!data]);

  const name = watch("name");
  useEffect(() => {
    if (!slugTouched) setValue("slug", slugify(name));
  }, [name, slugTouched, setValue]);

  async function onSubmit(v: Values) {
    setSaveError(null);
    try {
      const l = await saveListing({ ...v, id }, photos);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      if (isNew) navigate(`/admin/bicycles/${l.id}`, { replace: true });
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "Couldn't save. If you added large photos, try fewer or smaller ones.");
    }
  }

  if (loading || !data) return <Skeleton className="h-[600px] rounded-2xl" />;
  if (!isNew && !listing) return <NotFound />;
  const num = (k: keyof Values, label: string, hint?: string) => (
    <Field label={label} htmlFor={k} error={errors[k]?.message as string | undefined} hint={hint}><input id={k} type="number" step="any" className="field" {...register(k)} aria-invalid={!!errors[k]} /></Field>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-5xl">
      <Link to="/admin/bicycles" className="mb-4 inline-flex items-center gap-2 font-medium text-primary hover:underline"><ArrowLeft size={17} /> All bicycles</Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="h-display text-4xl sm:text-5xl">{isNew ? "Add a bicycle" : watch("name") || "Edit bicycle"}</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm font-semibold text-status-available" role="status">Saved. Live on the site.</span>}
          {listing?.is_active && <Link to={`/bicycles/${listing.slug}`} target="_blank" className="text-sm font-semibold text-primary hover:underline">View on site</Link>}
          <Button type="submit" variant="primary" loading={isSubmitting}>{isNew ? "Create bicycle" : "Save changes"}</Button>
        </div>
      </div>
      {saveError && <Alert className="mb-6">{saveError}</Alert>}
      {Object.keys(errors).length > 0 && <Alert className="mb-6">Please fix the highlighted fields below.</Alert>}
      <div className="space-y-6">
        <section className="card grid gap-5 p-6 sm:grid-cols-2">
          <h2 className="text-lg font-semibold sm:col-span-2">Basics</h2>
          <Field label="Name" htmlFor="name" error={errors.name?.message}><input id="name" className="field" {...register("name")} /></Field>
          <Field label="Web address" htmlFor="slug" error={errors.slug?.message} hint={`/bicycles/${watch("slug") || "…"}`}><input id="slug" className="field font-mono text-sm" {...register("slug", { onChange: () => setSlugTouched(true) })} /></Field>
          <Field label="Category" htmlFor="category_id" error={errors.category_id?.message}>
            <select id="category_id" className="field" {...register("category_id")}><option value="">Choose…</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </Field>
          <Field label="Type" htmlFor="bike_type"><select id="bike_type" className="field" {...register("bike_type")}><option value="standard">Standard</option><option value="electric">Electric</option></select></Field>
          <div className="sm:col-span-2"><Field label="One-line description" htmlFor="short_description" error={errors.short_description?.message}><input id="short_description" className="field" {...register("short_description")} /></Field></div>
          <div className="sm:col-span-2"><Field label="Full description" htmlFor="description"><textarea id="description" rows={4} className="field" {...register("description")} /></Field></div>
          <div className="sm:col-span-2"><Field label="Features" htmlFor="features" error={errors.features?.message}><Controller control={control} name="features" render={({ field }) => <Chips value={field.value} onChange={field.onChange} />} /></Field></div>
        </section>
        <section className="card grid gap-5 p-6 sm:grid-cols-4">
          <h2 className="text-lg font-semibold sm:col-span-4">Price, supply and size</h2>
          {num("daily_price", "Price per day ($)", "Charged per calendar day")}
          {num("daily_limit", "Daily limit", "Max bicycles vendors can supply per day")}
          {num("rider_height_min_cm", "Rider min (cm)")}
          {num("rider_height_max_cm", "Rider max (cm)")}
          <div className="flex flex-wrap gap-6 sm:col-span-4">
            <Controller control={control} name="is_active" render={({ field }) => <Toggle label="Shown on the website" checked={field.value} onChange={field.onChange} />} />
            <Controller control={control} name="is_featured" render={({ field }) => <Toggle label="Featured on home page" checked={field.value} onChange={field.onChange} />} />
          </div>
        </section>
        <section className="card p-6"><h2 className="mb-4 text-lg font-semibold">Photos</h2><Photos photos={photos} onChange={setPhotos} /></section>
      </div>
    </form>
  );
}
