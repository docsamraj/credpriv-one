'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Overview {
  pendingApplications: number;
  pendingVerifications: number;
  committeeReadyCases: number;
  expiringCredentials30: number;
  expiringCredentials60: number;
  expiringCredentials90: number;
  temporaryPrivileges: number;
  overdueReappointments: number;
  avgTurnaroundDays: number;
}

interface Trend {
  month: string;
  submitted: number;
  approved: number;
  denied: number;
}

export default function AnalyticsDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<Trend[]>([]);

  useEffect(() => {
    Promise.all([
      api<Overview>('/api/analytics/overview'),
      api<Trend[]>('/api/analytics/trends'),
    ]).then(([o, t]) => {
      setOverview(o);
      setTrends(t);
    }).catch(console.error);
  }, []);

  return (
    <div>
      <div className="section-header">
        <h2>Analytics & Executive Dashboard</h2>
      </div>

      <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>Operational Metrics</h3>
      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Pending Applications</div>
          <div className="value">{overview?.pendingApplications ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Pending PSV</div>
          <div className="value">{overview?.pendingVerifications ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Committee Ready</div>
          <div className="value">{overview?.committeeReadyCases ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Avg Turnaround (days)</div>
          <div className="value">{overview?.avgTurnaroundDays ?? '—'}</div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--color-text-muted)' }}>Credential Expiry Alerts</h3>
      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Expiring in 30 days</div>
          <div className="value" style={{ color: 'var(--color-danger)' }}>{overview?.expiringCredentials30 ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Expiring in 60 days</div>
          <div className="value" style={{ color: 'var(--color-warning)' }}>{overview?.expiringCredentials60 ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Expiring in 90 days</div>
          <div className="value">{overview?.expiringCredentials90 ?? '—'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Temporary Privileges</div>
          <div className="value">{overview?.temporaryPrivileges ?? '—'}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Monthly Trends</h3>
        {trends.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No trend data available yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Submitted</th>
                <th>Approved</th>
                <th>Denied</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => (
                <tr key={t.month}>
                  <td>{t.month}</td>
                  <td>{t.submitted}</td>
                  <td>{t.approved}</td>
                  <td>{t.denied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
