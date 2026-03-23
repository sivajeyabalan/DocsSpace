import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const { session } = useAuth();

  return (
    <AppShell>
      <h2 className="text-xl font-semibold text-ink-900">Phase 2 and 3 ready</h2>
      <p className="mt-2 text-sm text-slate-600">
        Manage your tenant users, invitations, teams, and document permissions from the
        sections below.
      </p>

      <dl className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd className="mt-1 font-medium text-slate-800">{session?.user.email}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Tenant</dt>
          <dd className="mt-1 font-medium text-slate-800">{session?.tenant.slug}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Role</dt>
          <dd className="mt-1 font-medium capitalize text-slate-800">{session?.tenant.role}</dd>
        </div>
      </dl>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link className="rounded-xl border border-slate-200 bg-white p-4 text-sm hover:bg-slate-50" to="/members">
          <p className="font-semibold text-slate-900">Members</p>
          <p className="mt-1 text-slate-600">Change roles and remove tenant members.</p>
        </Link>
        <Link className="rounded-xl border border-slate-200 bg-white p-4 text-sm hover:bg-slate-50" to="/invitations">
          <p className="font-semibold text-slate-900">Invitations</p>
          <p className="mt-1 text-slate-600">Invite new users and revoke pending links.</p>
        </Link>
        <Link className="rounded-xl border border-slate-200 bg-white p-4 text-sm hover:bg-slate-50" to="/teams">
          <p className="font-semibold text-slate-900">Teams</p>
          <p className="mt-1 text-slate-600">Create teams and manage team membership.</p>
        </Link>
        <Link className="rounded-xl border border-slate-200 bg-white p-4 text-sm hover:bg-slate-50" to="/documents">
          <p className="font-semibold text-slate-900">Documents</p>
          <p className="mt-1 text-slate-600">Create docs and assign user/team ACL grants.</p>
        </Link>
      </div>
    </AppShell>
  );
}
