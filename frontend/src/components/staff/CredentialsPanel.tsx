'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface VerificationRequest {
  id: string;
  status: string;
  source?: string;
  requestedAt: string;
  remarks?: string;
  credential: {
    id: string;
    type: string;
    title: string;
    identifier?: string;
    issuingBody?: string;
    expiryDate?: string;
    provider: {
      user: { firstName: string; lastName: string };
    };
  };
}

interface ExpiringCredential {
  id: string;
  type: string;
  title: string;
  expiryDate: string;
  provider: {
    user: { firstName: string; lastName: string; email: string };
  };
}

export default function CredentialsPanel() {
  const [pending, setPending] = useState<VerificationRequest[]>([]);
  const [expiring, setExpiring] = useState<ExpiringCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([
        api<VerificationRequest[]>('/api/credentials/verifications/pending'),
        api<ExpiringCredential[]>('/api/credentials/expiring/60'),
      ]);
      setPending(p);
      setExpiring(e);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function completeVerification(id: string, status: 'COMPLETED' | 'FAILED') {
    setActionId(id);
    try {
      await api(`/api/credentials/verifications/${id}`, {
        method: 'PATCH',
        body: { status, remarks: remarks[id] || undefined },
      });
      showMessage('success', status === 'COMPLETED' ? 'PSV marked complete' : 'PSV marked failed');
      loadData();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'PSV update failed');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      {message && (
        <div style={{
          position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000,
          padding: '0.75rem 1.25rem', borderRadius: '8px',
          background: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
          color: 'white', fontSize: '0.875rem',
        }}>
          {message.text}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Pending Primary Source Verification ({pending.length})</h3>
        {loading ? (
          <p>Loading…</p>
        ) : pending.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No pending PSV requests.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Credential</th>
                <th>Source</th>
                <th>Requested</th>
                <th>Remarks</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((v) => (
                <tr key={v.id}>
                  <td>{v.credential.provider.user.firstName} {v.credential.provider.user.lastName}</td>
                  <td>
                    <div>{v.credential.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {v.credential.type}{v.credential.identifier ? ` · ${v.credential.identifier}` : ''}
                    </div>
                  </td>
                  <td>{v.source || '—'}</td>
                  <td>{new Date(v.requestedAt).toLocaleDateString()}</td>
                  <td>
                    <input
                      className="form-input"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                      placeholder="PSV notes"
                      value={remarks[v.id] || ''}
                      onChange={(e) => setRemarks((prev) => ({ ...prev, [v.id]: e.target.value }))}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.3rem 0.6rem', marginRight: '0.35rem' }}
                      disabled={actionId === v.id}
                      onClick={() => completeVerification(v.id, 'COMPLETED')}
                    >
                      Verify
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.6rem' }}
                      disabled={actionId === v.id}
                      onClick={() => completeVerification(v.id, 'FAILED')}
                    >
                      Fail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Expiring Credentials (next 60 days)</h3>
        {loading ? (
          <p>Loading…</p>
        ) : expiring.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No credentials expiring soon.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Staff member</th>
                <th>Credential</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((c) => (
                <tr key={c.id}>
                  <td>{c.provider.user.firstName} {c.provider.user.lastName}</td>
                  <td>{c.title} ({c.type})</td>
                  <td>{new Date(c.expiryDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
