'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, setToken, setUser, getDefaultRoute } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!privacyAccepted) {
      setError('You must accept the privacy notice to create an account');
      return;
    }

    setLoading(true);
    try {
      const result = await api<{ user: { roles: string[]; providerId?: string }; accessToken: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: { email, password, firstName, lastName, privacyNoticeAccepted: true },
        }
      );

      setToken(result.accessToken);
      setUser(result.user);
      router.push(getDefaultRoute(result.user.roles));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Create Account</h1>
        <p className="subtitle">Register as a hospital staff applicant</p>

        {error && (
          <div style={{ background: '#f8d7da', color: '#721c24', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="firstName">First name</label>
              <input id="firstName" className="form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" className="form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="form-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hospital.org" required />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className="form-input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
          </div>

          <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.45 }}>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Privacy notice (DPDP):</strong> We process your personal data (name, email, contact details,
              identity documents such as Aadhaar/PAN/passport, education and professional credentials) solely for
              hospital credentialing, privileging, background verification, and related compliance. Data may be
              accessed by credentialing staff, department heads, and committee members. Optional AI parsing of job
              descriptions may use a cloud processor — do not upload unnecessary personal data in JD files.
            </p>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', cursor: 'pointer', color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                required
                style={{ marginTop: 3 }}
              />
              <span>I have read and accept this privacy notice and consent to processing for credentialing purposes.</span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading || !privacyAccepted}>
            {loading ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <p style={{ marginTop: '1rem', fontSize: '0.875rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--color-primary)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
