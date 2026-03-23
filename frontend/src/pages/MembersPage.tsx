import { useEffect, useState } from 'react';
import * as api from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../hooks/useAuth';
import type { TenantMember } from '../types/collab';

type Role = 'owner' | 'admin' | 'member' | 'guest';

export function MembersPage() {
  const { session } = useAuth();
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMembers() {
    if (!session) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.listTenantMembers({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
      });
      setMembers(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.tenant.slug]);

  async function onRoleChange(userId: string, role: Role) {
    if (!session) {
      return;
    }
    try {
      await api.updateTenantMemberRole({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        userId,
        role,
      });
      await loadMembers();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Failed to update role');
    }
  }

  async function onRemove(userId: string) {
    if (!session) {
      return;
    }
    try {
      await api.removeTenantMember({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        userId,
      });
      await loadMembers();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove member');
    }
  }

  return (
    <AppShell>
      <h2 className="text-xl font-semibold text-ink-900">Tenant Members</h2>
      <p className="mt-2 text-sm text-slate-600">Manage tenant roles and membership.</p>
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="mt-4 text-sm text-slate-500">Loading members...</p> : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-slate-100">
                <td className="px-2 py-3 text-slate-800">{member.user.email}</td>
                <td className="px-2 py-3">
                  <select
                    value={member.role}
                    className="rounded-lg border border-slate-200 px-2 py-1"
                    onChange={(event) =>
                      void onRoleChange(member.userId, event.target.value as Role)
                    }
                  >
                    <option value="owner">owner</option>
                    <option value="admin">admin</option>
                    <option value="member">member</option>
                    <option value="guest">guest</option>
                  </select>
                </td>
                <td className="px-2 py-3">
                  <button
                    type="button"
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                    onClick={() => void onRemove(member.userId)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
