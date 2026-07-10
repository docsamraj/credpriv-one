'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function PrivacyPanel() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function exportData() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Record<string, unknown>>('/api/privacy/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credpriv-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Your data export was downloaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  async function requestErasure() {
    if (!confirm('Request erasure of your personal data? Credentialing staff will review legal holds before completing.')) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api<{ message: string }>('/api/privacy/erase-request', { method: 'POST' });
      setMessage(result.message || 'Erasure request recorded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem' }}>Privacy &amp; your data (DPDP)</h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Download a copy of personal data we hold about you, or request erasure. Erasure may be delayed where
        credentialing records must be retained for accreditation or legal purposes.
      </p>
      {message && <p style={{ color: 'var(--color-success)', fontSize: '0.875rem' }}>{message}</p>}
      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={exportData}>
          Download my data
        </button>
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={requestErasure}>
          Request erasure
        </button>
      </div>
    </div>
  );
}
