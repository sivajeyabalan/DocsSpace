import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../api/client';
import { STORAGE_KEY } from '../hooks/auth-context';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login({ email, password, tenantSlug });
      const inviteToken = searchParams.get('inviteToken');
      const inviteTenant = searchParams.get('inviteTenant');
      if (inviteToken) {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            accessToken: string;
            tenant: { slug: string };
          };
          await api.acceptInvitation({
            accessToken: parsed.accessToken,
            tenantSlug: inviteTenant ?? tenantSlug ?? parsed.tenant.slug,
            token: inviteToken,
          });
        }
      }
      navigate('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-docspace-700">
          DocSpace
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-ink-900">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to continue to your workspace.</p>
        {searchParams.get('inviteToken') ? (
          <p className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-700">
            Invitation token detected. Login will automatically accept your invite.
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="docspace-input"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="docspace-input"
          required
        />
        <input
          value={tenantSlug}
          onChange={(event) => setTenantSlug(event.target.value)}
          placeholder="Tenant slug"
          className="docspace-input"
          required
        />
          <button type="submit" disabled={loading} className="docspace-button">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        </form>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <p className="mt-5 text-sm text-slate-600">
          No account yet?{' '}
          <Link to="/register" className="font-medium text-docspace-700 hover:text-docspace-500">
            Register
          </Link>
        </p>
      </section>
    </main>
  );
}
