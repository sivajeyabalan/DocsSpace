import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await register({ email, password, tenantName, tenantSlug });
      navigate('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Registration failed');
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
        <h1 className="mt-3 text-3xl font-semibold text-ink-900">Create account</h1>
        <p className="mt-2 text-sm text-slate-600">Set up your tenant and start collaborating.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <input
          value={tenantName}
          onChange={(event) => setTenantName(event.target.value)}
          placeholder="Tenant name"
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
          minLength={8}
          required
        />
          <button type="submit" disabled={loading} className="docspace-button">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
        </form>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <p className="mt-5 text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-docspace-700 hover:text-docspace-500">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
