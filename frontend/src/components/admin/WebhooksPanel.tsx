'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';

const WEBHOOK_EVENTS = [
  'APPLICATION_SUBMITTED',
  'APPLICATION_APPROVED',
  'CREDENTIALING_COMPLETE',
  'PRIVILEGE_GRANTED',
  'COMMITTEE_DECISION_RECORDED',
  'MEETING_MINUTES_SENT',
];

interface IntegrationSystem {
  id: string;
  code: string;
  name: string;
}

interface WebhookSub {
  id: string;
  event: string;
  targetUrl: string;
  isActive: boolean;
  system: { code: string; name: string };
}

export default function WebhooksPanel() {
  const [systems, setSystems] = useState<IntegrationSystem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSub[]>([]);
  const [systemCode, setSystemCode] = useState('');
  const [event, setEvent] = useState(WEBHOOK_EVENTS[0]);
  const [targetUrl, setTargetUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [sys, hooks] = await Promise.all([
      api<IntegrationSystem[]>('/api/admin/integration-systems'),
      api<WebhookSub[]>('/api/admin/webhooks'),
    ]);
    setSystems(sys);
    setWebhooks(hooks);
    if (!systemCode && sys[0]) setSystemCode(sys[0].code);
  }, [systemCode]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await api('/api/admin/webhooks', {
        method: 'POST',
        body: { systemCode, event, targetUrl, secret: secret || undefined },
      });
      setTargetUrl('');
      setSecret('');
      setMessage('Webhook subscription created');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Register outbound webhooks for HIS/EMR interoperability. Events fire on application and committee lifecycle changes.
      </p>
      {message && <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>{message}</p>}

      <form onSubmit={handleCreate} className="card" style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ marginBottom: '1rem' }}><Plus size={16} style={{ display: 'inline' }} /> New webhook</h4>
        <div className="form-group">
          <label>Integration system</label>
          <select className="form-input" value={systemCode} onChange={(e) => setSystemCode(e.target.value)}>
            {systems.map((s) => <option key={s.id} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Event</label>
          <select className="form-input" value={event} onChange={(e) => setEvent(e.target.value)}>
            {WEBHOOK_EVENTS.map((ev) => <option key={ev} value={ev}>{ev.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Target URL</label>
          <input className="form-input" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://his.hospital.org/webhooks/credpriv" required />
        </div>
        <div className="form-group">
          <label>Signing secret (optional)</label>
          <input className="form-input" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="HMAC secret for X-CredPriv-Signature header" />
        </div>
        <button type="submit" className="btn btn-primary">Add webhook</button>
      </form>

      <div className="card">
        <h4 style={{ marginBottom: '1rem' }}>Active subscriptions</h4>
        {webhooks.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No webhooks configured.</p>
        ) : (
          <table className="table">
            <thead><tr><th>System</th><th>Event</th><th>URL</th><th>Active</th></tr></thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id}>
                  <td>{w.system.name}</td>
                  <td>{w.event.replace(/_/g, ' ')}</td>
                  <td style={{ fontSize: '0.75rem' }}>{w.targetUrl}</td>
                  <td>{w.isActive ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
