import { Pencil, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert, Badge, Button, Field, Sheet, Skeleton } from "@/components/ui";
import { useData } from "@/hooks/useData";
import { ApiError, adminData, currentUser, saveUser } from "@/lib/api";
import type { Role } from "@/lib/types";
import { AdminTitle, Table } from "./AdminLayout";

type Editing = { id?: string; name: string; email: string; role: Role };
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", handover_staff: "Handover staff" };

function UserForm({ user, onDone }: { user: Editing; onDone: () => void }) {
  const [u, setU] = useState({ ...user, password: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (u.name.trim().length < 2) return setError("Enter a name.");
    if (!/^\S+@\S+\.\S+$/.test(u.email)) return setError("Enter a valid email.");
    if (!u.id && u.password.length < 8) return setError("Set a temporary password of at least 8 characters.");
    setSaving(true);
    try {
      await saveUser({ ...u, password: u.password || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Name" htmlFor="un"><input id="un" className="field" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /></Field>
      <Field label="Email" htmlFor="ue"><input id="ue" type="email" className="field" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} /></Field>
      <Field label={u.id ? "New password (optional)" : "Temporary password"} htmlFor="up" hint="Prototype: in production this would send an invitation email instead.">
        <input id="up" type="password" autoComplete="new-password" className="field" value={u.password} onChange={(e) => setU({ ...u, password: e.target.value })} />
      </Field>
      <fieldset>
        <legend className="field-label">Role</legend>
        {(["admin", "handover_staff"] as const).map((r) => (
          <label key={r} className="mr-6 inline-flex items-center gap-2"><input type="radio" className="accent-[rgb(var(--re-primary))]" checked={u.role === r} onChange={() => setU({ ...u, role: r })} /> {ROLE_LABEL[r]}</label>
        ))}
        <p className="mt-1 text-sm text-ink-soft">Handover staff only see the /staff app: today's handovers and returns.</p>
      </fieldset>
      {error && <Alert>{error}</Alert>}
      <div className="flex justify-end gap-2 border-t border-line pt-4"><Button variant="outline" onClick={onDone}>Cancel</Button><Button type="submit" variant="primary" loading={saving}>Save user</Button></div>
    </form>
  );
}

export default function UsersAdmin() {
  const { data, loading } = useData(adminData);
  const [editing, setEditing] = useState<Editing | null>(null);
  if (loading || !data) return <Skeleton className="h-64 rounded-2xl" />;
  const me = currentUser()?.id;
  return (
    <>
      <AdminTitle title="Users" actions={<Button onClick={() => setEditing({ name: "", email: "", role: "handover_staff" })}><Plus size={18} /> Add user</Button>}>Who can sign in to the admin or the staff app.</AdminTitle>
      <Table head={["Name", "Email", "Role", ""]}>
        {data.users.map((u) => {
          const role = data.user_roles.find((r) => r.user_id === u.id)?.role ?? "handover_staff";
          return (
            <tr key={u.id}>
              <td className="px-4 py-3 font-semibold">{u.name}{u.id === me && <span className="ml-2 text-xs text-ink-soft">(you)</span>}</td>
              <td className="px-4 py-3">{u.email}</td>
              <td className="px-4 py-3"><Badge tone={role === "admin" ? "primary" : "tint"}>{ROLE_LABEL[role]}</Badge></td>
              <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setEditing({ id: u.id, name: u.name, email: u.email, role })}><Pencil size={15} /> Edit</Button></td>
            </tr>
          );
        })}
      </Table>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit user" : "New user"}>
        {editing && <UserForm key={editing.id ?? "new"} user={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}
