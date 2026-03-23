import { useEffect, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../hooks/useAuth';
import type { Invitation } from '../types/collab';

type InvitationRole = 'admin' | 'member' | 'guest';

export function InvitationsPage() {
  const { session } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitationRole>('member');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadInvitations() {
    if (!session) {
      return;
    }
    setError(null);
    try {
      const result = await api.listInvitations({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
      });
      setInvitations(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load invitations',
      );
    }
  }

  useEffect(() => {
    void loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.tenant.slug]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }
    setError(null);
    try {
      const created = await api.createInvitation({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        email,
        role,
        expiresInDays,
      });
      setLastToken(created.token);
      const baseUrl = window.location.origin;
      setLastInviteLink(
        `${baseUrl}/invitations/accept?token=${encodeURIComponent(created.token)}&tenant=${encodeURIComponent(session.tenant.slug)}`,
      );
      setEmail('');
      await loadInvitations();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create invitation');
    }
  }

  async function onRevoke(invitationId: string) {
    if (!session) {
      return;
    }
    try {
      await api.revokeInvitation({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        invitationId,
      });
      await loadInvitations();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : 'Failed to revoke invitation');
    }
  }

  return (
    <AppShell>
      <h2 className="text-xl font-semibold text-ink-900">Invitations</h2>
      <p className="mt-2 text-sm text-slate-600">
        Create tenant invitations and revoke pending ones.
      </p>
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {lastToken ? (
        <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          <p>
            Invite token (dev flow): <span className="font-mono">{lastToken}</span>
          </p>
          {lastInviteLink ? (
            <p className="mt-2 break-all">
              Invite link: <span className="font-mono">{lastInviteLink}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <form className="mt-5 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-4" onSubmit={onCreate}>
        <input
          className="docspace-input sm:col-span-2"
          placeholder="invitee@email.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <select
          className="docspace-input"
          value={role}
          onChange={(event) => setRole(event.target.value as InvitationRole)}
        >
          <option value="admin">admin</option>
          <option value="member">member</option>
          <option value="guest">guest</option>
        </select>
        <div className="flex gap-2">
          <input
            type="number"
            min={1}
            max={30}
            className="docspace-input"
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(Number(event.target.value))}
          />
          <button className="docspace-button w-auto px-4" type="submit">
            Invite
          </button>
        </div>
      </form>

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2">Role</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((invitation) => (
              <tr key={invitation.id} className="border-b border-slate-100">
                <td className="px-2 py-3">{invitation.email}</td>
                <td className="px-2 py-3">{invitation.role}</td>
                <td className="px-2 py-3">{invitation.status}</td>
                <td className="px-2 py-3">
                  {invitation.status === 'pending' ? (
                    <button
                      type="button"
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                      onClick={() => void onRevoke(invitation.id)}
                    >
                      Revoke
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
