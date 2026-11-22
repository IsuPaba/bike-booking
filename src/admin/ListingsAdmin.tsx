import { Copy, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TypeChip } from "@/components/bikes";
import { Button, ButtonLink, EmptyState, Skeleton, Toggle } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { adminData, duplicateListing, primaryImageFor, updateListingFlags } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { AdminTitle, Table } from "./AdminLayout";

export default function ListingsAdmin() {
  const navigate = useNavigate();
  const { data, loading } = useData(adminData);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const rows = useMemo(() => (data?.listings ?? []).filter((l) => (!cat || l.category_id === cat) && l.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => a.sort_order - b.sort_order), [data, q, cat]);

  return (
    <>
      <AdminTitle title="Bicycles" actions={<ButtonLink to="/admin/bicycles/new"><Plus size={18} /> Add bicycle</ButtonLink>}>
        Bicycle types tourists can book. The daily limit is how many your vendors can supply per day.
      </AdminTitle>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" size={18} aria-hidden />
          <input className="field pl-11" placeholder="Search bicycles" aria-label="Search bicycles" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="field sm:w-56" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{data?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      {loading || !data ? <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
        : rows.length === 0 ? <EmptyState title="No bicycles found" action={<Button variant="outline" onClick={() => { setQ(""); setCat(""); }}>Clear search</Button>} />
        : (
          <Table minWidth={900} head={["Bicycle", "Category", "Type", "Daily price", "Daily limit", "Active", "Featured", ""]}>
            {rows.map((l) => {
              const img = primaryImageFor(l.id, data.listing_images);
              return (
                <tr key={l.id} className="hover:bg-tint/20">
                  <td className="px-4 py-3"><Link to={`/admin/bicycles/${l.id}`} className="flex items-center gap-3 font-semibold hover:text-primary">
                    <span className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-tint">{img && <img src={img} alt="" className="h-full w-full object-cover mix-blend-multiply" />}</span>{l.name}</Link></td>
                  <td className="px-4 py-3 text-ink-soft">{data.categories.find((c) => c.id === l.category_id)?.name}</td>
                  <td className="px-4 py-3"><TypeChip listing={l} /></td>
                  <td className="px-4 py-3 tabular-nums">{formatMoney(l.daily_price)}</td>
                  <td className="px-4 py-3 tabular-nums">{l.daily_limit}</td>
                  <td className="px-4 py-3"><Toggle label={l.is_active ? "Shown" : "Hidden"} checked={l.is_active} onChange={(v) => updateListingFlags(l.id, { is_active: v })} /></td>
                  <td className="px-4 py-3"><Toggle label={l.is_featured ? "Yes" : "No"} checked={l.is_featured} onChange={(v) => updateListingFlags(l.id, { is_featured: v })} /></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-1">
                    <ButtonLink to={`/admin/bicycles/${l.id}`} variant="ghost" size="sm"><Pencil size={15} /> Edit</ButtonLink>
                    <Button variant="ghost" size="sm" onClick={async () => navigate(`/admin/bicycles/${(await duplicateListing(l.id)).id}`)}><Copy size={15} /> Duplicate</Button>
                  </div></td>
                </tr>
              );
            })}
          </Table>
        )}
    </>
  );
}
