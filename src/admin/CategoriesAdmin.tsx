import { ArrowDown, ArrowUp, Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert, Button, Dialog, EmptyState, Field, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, listCategories, listListings, moveCategory, saveCategory } from "@/lib/api";
import type { Category } from "@/lib/types";
import { AdminTitle } from "./AdminLayout";

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function CategoriesAdmin() {
  const { data, loading } = useData(async () => {
    const [categories, bikes] = await Promise.all([listCategories(), listListings({ includeInactive: true })]);
    return { categories, bikes };
  });
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editing.name?.trim()) return setError("Give the category a name.");
    setSaving(true);
    setError(null);
    try {
      await saveCategory({ id: editing.id, name: editing.name.trim(), slug: slugify(editing.name), description: editing.description?.trim() ?? "" });
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminTitle title="Categories" actions={<Button onClick={() => { setError(null); setEditing({ name: "", description: "" }); }}><Plus size={18} /> Add category</Button>}>
        The order here is the order guests see in filters.
      </AdminTitle>

      {loading || !data ? (
        <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : data.categories.length === 0 ? (
        <EmptyState title="No categories yet">Add your first category to group your bicycles.</EmptyState>
      ) : (
        <ol className="card max-w-3xl divide-y divide-line">
          {data.categories.map((c, i) => (
            <li key={c.id} className="flex items-center gap-4 p-4">
              <span className="w-6 text-center font-bold text-ink-soft">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.name}</p>
                <p className="truncate text-sm text-ink-soft">{c.description || "No description"} · {data.bikes.filter((b) => b.category_id === c.id).length} bicycles</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => moveCategory(c.id, -1)} disabled={i === 0} aria-label={`Move ${c.name} up`}><ArrowUp size={16} /></Button>
                <Button variant="ghost" size="sm" onClick={() => moveCategory(c.id, 1)} disabled={i === data.categories.length - 1} aria-label={`Move ${c.name} down`}><ArrowDown size={16} /></Button>
                <Button variant="ghost" size="sm" onClick={() => { setError(null); setEditing(c); }}><Pencil size={15} /> Edit</Button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit category" : "New category"}>
        <form onSubmit={submit} className="mt-2 space-y-4 text-ink">
          <Field label="Name" htmlFor="cat-name"><input id="cat-name" className="field" value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Description" htmlFor="cat-desc"><input id="cat-desc" className="field" value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
          {error && <Alert>{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" variant="primary" loading={saving}>Save</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
