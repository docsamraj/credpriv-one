'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { FileText, Upload, AlertTriangle, Clock } from 'lucide-react';

interface Application {
  id: string;
  type: string;
  status: string;
  submittedAt?: string;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'badge-neutral',
  SUBMITTED: 'badge-info',
  UNDER_VERIFICATION: 'badge-warning',
  COMMITTEE: 'badge-warning',
  APPROVED: 'badge-success',
  DENIED: 'badge-danger',
  NEEDS_INFO: 'badge-danger',
};

export default function ProviderDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Application[]>('/api/applications')
      .then(setApplications)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="section-header">
        <h2>Provider Dashboard</h2>
        <button className="btn btn-primary">
          <FileText size={16} />
          New Application
        </button>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Active Applications</div>
          <div className="value">{applications.filter((a) => !['APPROVED', 'DENIED'].includes(a.status)).length}</div>
        </div>
        <div className="stat-card">
          <div className="label"><Clock size={14} style={{ display: 'inline' }} /> Pending Review</div>
          <div className="value">{applications.filter((a) => ['SUBMITTED', 'UNDER_VERIFICATION'].includes(a.status)).length}</div>
        </div>
        <div className="stat-card">
          <div className="label"><AlertTriangle size={14} style={{ display: 'inline' }} /> Expiring Soon</div>
          <div className="value" style={{ color: 'var(--color-warning)' }}>—</div>
        </div>
        <div className="stat-card">
          <div className="label"><Upload size={14} style={{ display: 'inline' }} /> Documents</div>
          <div className="value">—</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>My Applications</h3>
        {loading ? (
          <p>Loading...</p>
        ) : applications.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No applications yet. Start a new application to begin credentialing.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>{app.type.replace(/_/g, ' ')}</td>
                  <td><span className={`badge ${STATUS_BADGE[app.status] || 'badge-neutral'}`}>{app.status}</span></td>
                  <td>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '—'}</td>
                  <td><button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem' }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Document Checklist</h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Upload required documents based on your specialty. Documents are verified by credentialing staff via primary source verification.
        </p>
        <div style={{ marginTop: '1rem' }}>
          {['Medical License', 'Medical Degree', 'Board Certification', 'Malpractice Insurance', 'Government ID'].map((doc) => (
            <div key={doc} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <span>{doc}</span>
              <button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
                <Upload size={14} /> Upload
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
