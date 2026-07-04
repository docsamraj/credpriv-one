'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { X } from 'lucide-react';

interface Queues {
  newApplications: number;
  pendingDocuments: number;
  pendingPsv: number;
  committeeReady: number;
}

interface Application {
  id: string;
  type: string;
  status: string;
  committeeReady: boolean;
  submittedAt?: string;
  createdAt: string;
  provider: {
    user: { firstName: string; lastName: string };
    profile?: { department?: { name: string }; specialty?: { name: string } };
  };
}

export default function StaffDashboard() {
  const [queues, setQueues] = useState<Queues | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [q, apps] = await Promise.all([
        api<Queues>('/api/applications/queues'),
        api<Application[]>('/api/applications'),
      ]);
      setQueues(q);
      setApplications(apps);
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

  async function handleMarkReady(id: string) {
    setActionLoading(true);
    try {
      const updated = await api<Application>(`/api/applications/${id}/committee-ready`, { method: 'POST' });
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
      if (selectedApp?.id === id) setSelectedApp(updated);
      const q = await api<Queues>('/api/applications/queues');
      setQueues(q);
      showMessage('success', 'Application marked committee-ready');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to mark ready');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      {message && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            zIndex: 1000,
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            background: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            color: 'white',
            fontSize: '0.875rem',
          }}
        >
          {message.text}
        </div>
      )}

      <div className="section-header">
        <h2>Credentialing Staff Dashboard</h2>
        {process.env.NEXT_PUBLIC_BUILD_SHA && (
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
            build {process.env.NEXT_PUBLIC_BUILD_SHA.slice(0, 7)}
          </span>
        )}
      </div>

      <div className="queue-grid">
        <div className="queue-card">
          <div className="count">{queues?.newApplications ?? '—'}</div>
          <div className="title">New Applications</div>
        </div>
        <div className="queue-card">
          <div className="count">{queues?.pendingDocuments ?? '—'}</div>
          <div className="title">Pending Documents</div>
        </div>
        <div className="queue-card">
          <div className="count">{queues?.pendingPsv ?? '—'}</div>
          <div className="title">Pending PSV</div>
        </div>
        <div className="queue-card">
          <div className="count">{queues?.committeeReady ?? '—'}</div>
          <div className="title">Committee Ready</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Application Queue</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Department</th>
                <th>Type</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>Dr. {app.provider.user.firstName} {app.provider.user.lastName}</td>
                  <td>{app.provider.profile?.department?.name ?? '—'}</td>
                  <td>{app.type.replace(/_/g, ' ')}</td>
                  <td>
                    <span className={`badge ${app.committeeReady ? 'badge-success' : 'badge-warning'}`}>
                      {app.status}
                    </span>
                  </td>
                  <td>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.375rem 0.75rem', marginRight: '0.5rem' }}
                      onClick={() => setSelectedApp(app)}
                    >
                      Review
                    </button>
                    {!app.committeeReady && app.status === 'UNDER_VERIFICATION' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.375rem 0.75rem' }}
                        onClick={() => handleMarkReady(app.id)}
                        disabled={actionLoading}
                      >
                        Mark Ready
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedApp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
          onClick={() => setSelectedApp(null)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: '520px', margin: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3>Application Review</h3>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem 1rem', fontSize: '0.875rem' }}>
              <dt style={{ color: 'var(--color-text-muted)' }}>Provider</dt>
              <dd>Dr. {selectedApp.provider.user.firstName} {selectedApp.provider.user.lastName}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Department</dt>
              <dd>{selectedApp.provider.profile?.department?.name ?? '—'}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Type</dt>
              <dd>{selectedApp.type.replace(/_/g, ' ')}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Status</dt>
              <dd>{selectedApp.status}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Committee Ready</dt>
              <dd>{selectedApp.committeeReady ? 'Yes' : 'No'}</dd>
            </dl>
            {!selectedApp.committeeReady && selectedApp.status === 'UNDER_VERIFICATION' && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '1.5rem', width: '100%' }}
                onClick={() => handleMarkReady(selectedApp.id)}
                disabled={actionLoading}
              >
                Mark Committee Ready
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
