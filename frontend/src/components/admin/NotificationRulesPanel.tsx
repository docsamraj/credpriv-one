'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface NotificationRule {
  id: string;
  name: string;
  event: string;
  channel: string;
  daysBefore?: number;
  isActive: boolean;
}

export default function NotificationRulesPanel() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [jobResult, setJobResult] = useState<string | null>(null);

  useEffect(() => {
    api<NotificationRule[]>('/api/admin/notification-rules').then(setRules).catch(console.error);
  }, []);

  async function runExpiryJob() {
    setJobResult(null);
    try {
      const result = await api<{ sent: number; skipped: number }>('/api/admin/jobs/credential-expiry-reminders', { method: 'POST' });
      setJobResult(`Job complete — ${result.sent} sent, ${result.skipped} skipped (already reminded)`);
    } catch (err) {
      setJobResult(err instanceof Error ? err.message : 'Job failed');
    }
  }

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Notification rules drive email and in-app alerts. Credential expiry reminders run automatically once daily on the server.
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ marginBottom: '0.75rem' }}>Manual job trigger</h4>
        <button type="button" className="btn btn-secondary" onClick={runExpiryJob}>Run credential expiry reminders now</button>
        {jobResult && <p style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>{jobResult}</p>}
      </div>

      <div className="card">
        <h4 style={{ marginBottom: '1rem' }}>Active rules</h4>
        <table className="table">
          <thead><tr><th>Name</th><th>Event</th><th>Channel</th><th>Days before</th><th>Active</th></tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.event.replace(/_/g, ' ')}</td>
                <td>{r.channel}</td>
                <td>{r.daysBefore ?? '—'}</td>
                <td>{r.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
