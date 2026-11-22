import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MapPicker } from "@/components/MapView";
import { Alert, Badge, Button, Field, Sheet, Skeleton, Toggle } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, adminData, saveHotel, savePickupPoint } from "@/lib/api";
import type { Hotel, PickupPoint } from "@/lib/types";
import { AdminTitle, Table } from "./AdminLayout";

const LA_DIGUE = { latitude: -4.3600, longitude: 55.8320 };
type Editing = { kind: "pickup"; row: Partial<PickupPoint> } | { kind: "hotel"; row: Partial<Hotel> };

function LocationForm({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  const [row, setRow] = useState<Record<string, unknown>>({ ...LA_DIGUE, is_active: true, ...(editing.kind === "pickup" ? { opens_at: "08:00", closes_at: "18:00", instructions: "" } : {}), ...editing.row });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: unknown) => setRow((r) => ({ ...r, [k]: v }));
  const text = (k: string, label: string, type = "text") => (
    <Field label={label} htmlFor={k}><input id={k} type={type} className="field" value={String(row[k] ?? "")} onChange={(e) => set(k, e.target.value)} /></Field>
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (String(row.name ?? "").trim().length < 2) return setError("Enter a name.");
    if (editing.kind === "pickup" && String(row.closes_at) <= String(row.opens_at)) return setError("Closing time must be after opening time.");
    setSaving(true);
    try {
      if (editing.kind === "pickup") await savePickupPoint(row as unknown as PickupPoint);
      else await saveHotel(row as unknown as Hotel);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {text("name", "Name")}
      {text("address", "Address")}
      {editing.kind === "pickup" && (
        <>
          <div className="grid grid-cols-2 gap-4">{text("opens_at", "Opens", "time")}{text("closes_at", "Closes", "time")}</div>
          <Field label="Instructions for guests" htmlFor="instructions"><textarea id="instructions" rows={3} className="field" value={String(row.instructions ?? "")} onChange={(e) => set("instructions", e.target.value)} /></Field>
        </>
      )}
      <div>
        <p className="field-label">Location</p>
        <MapPicker lat={Number(row.latitude)} lng={Number(row.longitude)} onPick={(lat, lng) => setRow((r) => ({ ...r, latitude: lat, longitude: lng }))} />
        <p className="mt-1 text-xs text-ink-soft tabular-nums">{Number(row.latitude).toFixed(5)}, {Number(row.longitude).toFixed(5)}</p>
      </div>
      <Toggle label="Active" checked={!!row.is_active} onChange={(v) => set("is_active", v)} />
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" variant="primary" loading={saving}>Save</Button></div>
    </form>
  );
}

export default function LocationsAdmin() {
  const { data, loading } = useData(adminData);
  const [editing, setEditing] = useState<Editing | null>(null);
  if (loading || !data) return <Skeleton className="h-96 rounded-2xl" />;
  return (
    <>
      <AdminTitle title="Pickup points & hotels">Where tourists collect bicycles, and the hotels you deliver to.</AdminTitle>
      <section className="mb-10">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Pickup points</h2><Button size="sm" onClick={() => setEditing({ kind: "pickup", row: {} })}><Plus size={16} /> Add pickup point</Button></div>
        <Table head={["Name", "Opening hours", "Coordinates", "Status", ""]}>
          {data.pickup_points.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3"><p className="font-semibold">{p.name}</p><p className="text-ink-soft">{p.address}</p></td>
              <td className="px-4 py-3">{p.opens_at}–{p.closes_at}</td>
              <td className="px-4 py-3 tabular-nums">{p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}</td>
              <td className="px-4 py-3"><Badge tone={p.is_active ? "available" : "outline"}>{p.is_active ? "Active" : "Inactive"}</Badge></td>
              <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing({ kind: "pickup", row: p })}><Pencil size={15} /> Edit</Button></td>
            </tr>
          ))}
        </Table>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Hotels (delivery)</h2><Button size="sm" onClick={() => setEditing({ kind: "hotel", row: {} })}><Plus size={16} /> Add hotel</Button></div>
        <Table head={["Hotel", "Coordinates", "Status", ""]}>
          {[...data.hotels].sort((a, b) => a.name.localeCompare(b.name)).map((h) => (
            <tr key={h.id}>
              <td className="px-4 py-3"><p className="font-semibold">{h.name}</p><p className="text-ink-soft">{h.address}</p></td>
              <td className="px-4 py-3 tabular-nums">{h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}</td>
              <td className="px-4 py-3"><Badge tone={h.is_active ? "available" : "outline"}>{h.is_active ? "Active" : "Inactive"}</Badge></td>
              <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing({ kind: "hotel", row: h })}><Pencil size={15} /> Edit</Button></td>
            </tr>
          ))}
        </Table>
      </section>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing ? `${editing.row.id ? "Edit" : "New"} ${editing.kind === "pickup" ? "pickup point" : "hotel"}` : ""}>
        {editing && <LocationForm key={editing.row.id ?? `new-${editing.kind}`} editing={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}
