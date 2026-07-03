'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, uploadFile } from '@/lib/api';
import { FileText, Upload, AlertTriangle, Clock, Check, X } from 'lucide-react';

interface Application {
  id: string;
  type: string;
  status: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  currentStage?: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
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

const DOC_CHECKLIST = [
  { label: 'Medical License', type: 'LICENSE' },
  { label: 'Medical Degree', type: 'DEGREE' },
  { label: 'Board Certification', type: 'BOARD_CERT' },
  { label: 'Malpractice Insurance', type: 'INSURANCE' },
  { label: 'Government ID', type: 'IDENTITY' },
];

export default function ProviderDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ type: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const apps = await api<Application[]>('/api/applications');
      setApplications(apps);
    } catch (err) {
      console.error(err);
    }
    try {
      const docs = await api<Document[]>('/api/documents/my');
      setDocuments(docs);
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

  async function handleNewApplication() {
    setActionLoading(true);
    try {
      const app = await api<Application>('/api/applications', {
        method: 'POST',
        body: { type: 'INITIAL_APPOINTMENT' },
      });
      setApplications((prev) => [app, ...prev]);
      showMessage('success', 'New application created');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to create application');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitApplication(id: string) {
    setActionLoading(true);
    try {
      const updated = await api<Application>(`/api/applications/${id}/submit`, { method: 'POST' });
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setSelectedApp(updated);
      showMessage('success', 'Application submitted for review');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to submit application');
    } finally {
      setActionLoading(false);
    }
  }

  function triggerUpload(type: string, name: string) {
    setPendingUpload({ type, name });
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingUpload) return;

    setActionLoading(true);
    try {
      const doc = await uploadFile<Document>('/api/documents/upload', file, {
        type: pendingUpload.type,
        name: pendingUpload.name,
      });
      setDocuments((prev) => [doc, ...prev.filter((d) => d.type !== pendingUpload.type)]);
      showMessage('success', `${pendingUpload.name} uploaded successfully`);
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setActionLoading(false);
      setPendingUpload(null);
    }
  }

  const uploadedTypes = new Set(documents.map((d) => d.type));

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

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
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {message.text}
        </div>
      )}

      <div className="section-header">
        <h2>Provider Dashboard</h2>
        {process.env.NEXT_PUBLIC_BUILD_SHA && (
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginRight: 'auto', marginLeft: '1rem' }}>
            build {process.env.NEXT_PUBLIC_BUILD_SHA.slice(0, 7)}
          </span>
        )}
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleNewApplication}
          disabled={actionLoading}
        >
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
          <div className="value">{documents.length}</div>
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
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.375rem 0.75rem' }}
                      onClick={() => setSelectedApp(app)}
                    >
                      View
                    </button>
                  </td>
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
          {DOC_CHECKLIST.map((doc) => {
            const uploaded = uploadedTypes.has(doc.type);
            return (
              <div
                key={doc.type}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {uploaded && <Check size={16} style={{ color: 'var(--color-success)' }} />}
                  {doc.label}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={() => triggerUpload(doc.type, doc.label)}
                  disabled={actionLoading}
                >
                  <Upload size={14} /> {uploaded ? 'Replace' : 'Upload'}
                </button>
              </div>
            );
          })}
        </div>
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
            style={{ width: '100%', maxWidth: '480px', margin: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Application Details</h3>
              <button
                type="button"
                onClick={() => setSelectedApp(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem 1rem', fontSize: '0.875rem' }}>
              <dt style={{ color: 'var(--color-text-muted)' }}>Type</dt>
              <dd>{selectedApp.type.replace(/_/g, ' ')}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Status</dt>
              <dd><span className={`badge ${STATUS_BADGE[selectedApp.status] || 'badge-neutral'}`}>{selectedApp.status}</span></dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Created</dt>
              <dd>{new Date(selectedApp.createdAt).toLocaleDateString()}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Submitted</dt>
              <dd>{selectedApp.submittedAt ? new Date(selectedApp.submittedAt).toLocaleDateString() : 'Not yet submitted'}</dd>
              {selectedApp.currentStage && (
                <>
                  <dt style={{ color: 'var(--color-text-muted)' }}>Stage</dt>
                  <dd>{selectedApp.currentStage.replace(/_/g, ' ')}</dd>
                </>
              )}
            </dl>
            {(selectedApp.status === 'DRAFT' || selectedApp.status === 'NEEDS_INFO') && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '1.5rem', width: '100%' }}
                onClick={() => handleSubmitApplication(selectedApp.id)}
                disabled={actionLoading}
              >
                Submit Application
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
