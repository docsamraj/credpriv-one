'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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
  provider: {
    user: { firstName: string; lastName: string };
    profile?: { department?: { name: string }; specialty?: { name: string } };
  };
  submittedAt?: string;
}

export default function StaffDashboard() {
  const [queues, setQueues] = useState<Queues | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);

  useEffect(() => {
    Promise.all([
      api<Queues>('/api/applications/queues'),
      api<Application[]>('/api/applications'),
    ]).then(([q, apps]) => {
      setQueues(q);
      setApplications(apps);
    }).catch(console.error);
  }, []);

  return (
    <div>
      <div className="section-header">
        <h2>Credentialing Staff Dashboard</h2>
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
                  <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', marginRight: '0.5rem' }}>Review</button>
                  {!app.committeeReady && app.status === 'UNDER_VERIFICATION' && (
                    <button className="btn btn-primary" style={{ padding: '0.375rem 0.75rem' }}>Mark Ready</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
