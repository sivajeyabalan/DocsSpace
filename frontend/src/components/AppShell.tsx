import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/members', label: 'Members' },
  { to: '/invitations', label: 'Invitations' },
  { to: '/teams', label: 'Teams' },
  { to: '/documents', label: 'Documents' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, logout } = useAuth();
  const location = useLocation();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-4 sm:p-8">
      <section className="rounded-2xl border border-sky-100 bg-white/90 p-5 shadow-xl shadow-sky-100 backdrop-blur sm:p-7">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-docspace-700">
              DocSpace
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink-900">Tenant Console</h1>
            <p className="mt-1 text-sm text-slate-600">
              {session?.tenant.slug} - {session?.user.email} ({session?.tenant.role})
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700"
            onClick={() => void logout()}
          >
            Logout
          </button>
        </header>

        <nav className="mt-4 flex flex-wrap gap-2">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-docspace-500 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <section className="mt-6">{children}</section>
      </section>
    </main>
  );
}
