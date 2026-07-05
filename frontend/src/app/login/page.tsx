'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken, setUser, getDefaultRoute } from '@/lib/api';
import DemoAccounts from './demo-accounts';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api<{ user: { roles: string[] }; accessToken: string }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      setToken(result.accessToken);
      setUser(result.user);
      router.push(getDefaultRoute(result.user.roles));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>CredPriv One</h1>
        <p className="subtitle">Hospital Staff Credentialing Platform</p>

        {error && (
          <div style={{ background: '#f8d7da', color: '#721c24', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hospital.org"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <DemoAccounts />
      </div>
    </div>
  );
}
