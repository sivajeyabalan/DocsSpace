import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as api from '../api/client';
import { useAuth } from '../hooks/useAuth';

export function AcceptInvitationPage() {
  const { registerFromInvite, session, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const tenantSlugFromUrl = useMemo(
    () => searchParams.get('tenant') ?? '',
    [searchParams],
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState(tenantSlugFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError('Invitation token missing. Please use the full invite link.');
      return;
    }

    setLoading(true);
    setError(null);
    setNeedsLogin(false);
    try {
      await registerFromInvite({ email, password, token });
      navigate('/dashboard');
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Failed to accept invitation';
      setError(message);
      if (message.toLowerCase().includes('user already exists')) {
        setNeedsLogin(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function onAcceptAsLoggedInUser() {
    if (!session || !token || !tenantSlug) {
      setError('Token and tenant slug are required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.acceptInvitation({
        accessToken: session.accessToken,
        tenantSlug,
        token,
      });
      navigate('/dashboard');
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : 'Failed to accept invitation as existing user',
      );
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
        <h1 className="mt-3 text-3xl font-semibold text-ink-900">Accept invitation</h1>
        <p className="mt-2 text-sm text-slate-600">
          Create your account and join the invited tenant directly.
        </p>
        {!token ? (
          <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700">
            Invite token not found in URL.
          </p>
        ) : null}
        <input
          className="docspace-input mt-4"
          placeholder="Tenant slug (example: acme)"
          value={tenantSlug}
          onChange={(event) => setTenantSlug(event.target.value)}
          required
        />
        {isAuthenticated ? (
          <button
            type="button"
            className="docspace-button mt-3"
            onClick={() => void onAcceptAsLoggedInUser()}
            disabled={loading || !token || !tenantSlug}
          >
            {loading ? 'Accepting...' : 'Accept as logged-in user'}
          </button>
        ) : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
            type="email"
            className="docspace-input"
            placeholder="Invitation email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            type="password"
            className="docspace-input"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <button type="submit" className="docspace-button" disabled={loading || !token}>
            {loading ? 'Joining...' : 'Join tenant'}
          </button>
        </form>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {needsLogin ? (
          <p className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-700">
            Account already exists.{' '}
            <Link
              to={`/login?inviteToken=${encodeURIComponent(token)}&inviteTenant=${encodeURIComponent(tenantSlug)}`}
              className="font-medium text-docspace-700 underline"
            >
              Login and accept this invite
            </Link>
            .
          </p>
        ) : null}
        <p className="mt-5 text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to={`/login?inviteToken=${encodeURIComponent(token)}&inviteTenant=${encodeURIComponent(tenantSlug)}`}
            className="font-medium text-docspace-700 hover:text-docspace-500"
          >
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
