import { useEffect, useMemo, useState, type FormEvent } from 'react';
import * as api from '../api/client';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../hooks/useAuth';
import type { Team, TenantMember } from '../types/collab';

export function TeamsPage() {
  const { session } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [memberRole, setMemberRole] = useState<'lead' | 'member'>('member');
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    if (!session) {
      return;
    }

    try {
      const [teamsResult, membersResult] = await Promise.all([
        api.listTeams({
          accessToken: session.accessToken,
          tenantSlug: session.tenant.slug,
        }),
        api.listTenantMembers({
          accessToken: session.accessToken,
          tenantSlug: session.tenant.slug,
        }),
      ]);
      setTeams(teamsResult);
      setMembers(membersResult);
      if (teamsResult.length > 0 && !selectedTeamId) {
        setSelectedTeamId(teamsResult[0].id);
      }
      if (membersResult.length > 0 && !selectedUserId) {
        setSelectedUserId(membersResult[0].userId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load teams');
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.tenant.slug]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }
    try {
      await api.createTeam({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        name,
        slug: slug || undefined,
      });
      setName('');
      setSlug('');
      await loadData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create team');
    }
  }

  async function onAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !selectedTeamId || !selectedUserId) {
      return;
    }
    try {
      await api.addTeamMember({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        teamId: selectedTeamId,
        userId: selectedUserId,
        role: memberRole,
      });
      await loadData();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Failed to add team member');
    }
  }

  async function onDeleteTeam(teamId: string) {
    if (!session) {
      return;
    }
    try {
      await api.deleteTeam({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        teamId,
      });
      if (selectedTeamId === teamId) {
        setSelectedTeamId('');
      }
      await loadData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete team');
    }
  }

  async function onRemoveMember(teamId: string, userId: string) {
    if (!session) {
      return;
    }
    try {
      await api.removeTeamMember({
        accessToken: session.accessToken,
        tenantSlug: session.tenant.slug,
        teamId,
        userId,
      });
      await loadData();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Failed to remove team member');
    }
  }

  return (
    <AppShell>
      <h2 className="text-xl font-semibold text-ink-900">Teams</h2>
      <p className="mt-2 text-sm text-slate-600">Create teams and manage team members.</p>
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <form className="mt-5 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-4" onSubmit={onCreate}>
        <input
          className="docspace-input sm:col-span-2"
          placeholder="Team name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          className="docspace-input"
          placeholder="team-slug (optional)"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
        <button className="docspace-button" type="submit">
          Create Team
        </button>
      </form>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Team list</h3>
          <ul className="mt-3 space-y-2">
            {teams.map((team) => (
              <li key={team.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className={`text-left text-sm font-medium ${
                      selectedTeamId === team.id ? 'text-docspace-700' : 'text-slate-800'
                    }`}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    {team.name} ({team.slug})
                  </button>
                  <button
                    type="button"
                    className="rounded bg-rose-600 px-2 py-1 text-xs text-white"
                    onClick={() => void onDeleteTeam(team.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-800">Manage members</h3>
          <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={onAddMember}>
            <select
              className="docspace-input"
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.target.value)}
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <select
              className="docspace-input"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
            >
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId}>
                  {member.user.email}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                className="docspace-input"
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value as 'lead' | 'member')}
              >
                <option value="lead">lead</option>
                <option value="member">member</option>
              </select>
              <button className="docspace-button w-auto px-3" type="submit">
                Add
              </button>
            </div>
          </form>

          <ul className="mt-4 space-y-2">
            {selectedTeam?.teamMembers.map((member) => (
              <li key={member.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-2">
                <span className="text-sm text-slate-700">
                  {member.user.email} ({member.role})
                </span>
                <button
                  type="button"
                  className="rounded bg-rose-600 px-2 py-1 text-xs text-white"
                  onClick={() => void onRemoveMember(selectedTeam.id, member.userId)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
