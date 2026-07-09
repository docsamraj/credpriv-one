'use client';

import { useCallback, useEffect, useState, Fragment } from 'react';
import { api } from '@/lib/api';
import { PRODUCT_LABELS } from '@credpriv/shared';
import ApplicationDocumentInventory from '@/components/shared/ApplicationDocumentInventory';

interface PendingApp {
  id: string;
  workflowPhase?: string;
  status: string;
  submittedAt?: string;
  provider: {
    user: { firstName: string; lastName: string; email: string };
    profile?: {
      department?: { name: string };
      staffCategory?: { name: string };
      staffSubtype?: { name: string };
    };
  };
  staffCategory?: { name: string };
  staffSubtype?: { name: string };
}

interface Department {
  id: string;
  name: string;
  code?: string;
}

export default function DepartmentDashboard() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pending, setPending] = useState<PendingApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [actionAppId, setActionAppId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'return' | 'reject' | null>(null);
  const [actionComments, setActionComments] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [depts, apps] = await Promise.all([
        api<Department[]>('/api/department/my-departments'),
        api<PendingApp[]>('/api/department/pending-approvals'),
      ]);
      setDepartments(depts);
      setPending(apps);
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

  async function handleApprove(applicationId: string) {
    setActionLoading(true);
    try {
      await api(`/api/department/applications/${applicationId}/approve`, { method: 'POST' });
      showMessage('success', 'Department approval granted — sent to credentialing staff for final clearance');
      loadData();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReturnForInfo(applicationId: string) {
    if (!actionComments.trim()) {
      showMessage('error', 'Please enter comments for the applicant');
      return;
    }
    setActionLoading(true);
    try {
      await api(`/api/department/applications/${applicationId}/return-for-info`, {
        method: 'POST',
        body: { comments: actionComments.trim() },
      });
      showMessage('success', 'Application returned to applicant for more information');
      setActionAppId(null);
      setActionType(null);
      setActionComments('');
      loadData();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Return failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(applicationId: string) {
    if (!actionComments.trim()) {
      showMessage('error', 'Please enter a reason for rejection');
      return;
    }
    setActionLoading(true);
    try {
      await api(`/api/department/applications/${applicationId}/reject`, {
        method: 'POST',
        body: { rationale: actionComments.trim() },
      });
      showMessage('success', 'Application rejected');
      setActionAppId(null);
      setActionType(null);
      setActionComments('');
      loadData();
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActionLoading(false);
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

      <div className="section-header">
        <h2>Department Approvals</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ marginBottom: '0.5rem' }}>Your departments</h4>
        {departments.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No department chair assignment found.</p>
        ) : (
          <p style={{ fontSize: '0.875rem' }}>
            {departments.map((d) => d.name).join(' · ')}
          </p>
        )}
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Non-clinical {PRODUCT_LABELS.applicantPlural.toLowerCase()} require your approval before credentialing staff can complete onboarding.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Pending Department Approval ({pending.length})</h3>
        {loading ? (
          <p>Loading...</p>
        ) : pending.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No applications awaiting your approval.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{PRODUCT_LABELS.applicantSingular}</th>
                <th>Department</th>
                <th>Role</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((app) => (
                <Fragment key={app.id}>
                <tr>
                  <td>{app.provider.user.firstName} {app.provider.user.lastName}</td>
                  <td>{app.provider.profile?.department?.name ?? '—'}</td>
                  <td>{app.staffSubtype?.name ?? app.provider.profile?.staffSubtype?.name ?? '—'}</td>
                  <td>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.375rem 0.75rem', marginRight: '0.5rem' }}
                      onClick={() => setExpandedAppId(expandedAppId === app.id ? null : app.id)}
                    >
                      {expandedAppId === app.id ? 'Hide docs' : 'View docs'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.375rem 0.75rem', marginRight: '0.35rem' }}
                      onClick={() => handleApprove(app.id)}
                      disabled={actionLoading}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.375rem 0.75rem', marginRight: '0.35rem' }}
                      onClick={() => { setActionAppId(app.id); setActionType('return'); setActionComments(''); }}
                      disabled={actionLoading}
                    >
                      Return
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.375rem 0.75rem', color: 'var(--color-danger)' }}
                      onClick={() => { setActionAppId(app.id); setActionType('reject'); setActionComments(''); }}
                      disabled={actionLoading}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
                {expandedAppId === app.id && (
                  <tr key={`${app.id}-docs`}>
                    <td colSpan={5} style={{ background: 'var(--color-bg)' }}>
                      <ApplicationDocumentInventory applicationId={app.id} compact />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {actionAppId && actionType && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: 480 }}>
            <h3 style={{ marginBottom: '0.75rem' }}>
              {actionType === 'return' ? 'Return for more information' : 'Reject application'}
            </h3>
            <textarea
              className="form-input"
              rows={4}
              placeholder={actionType === 'return' ? 'What should the applicant provide or clarify?' : 'Reason for department rejection'}
              value={actionComments}
              onChange={(e) => setActionComments(e.target.value)}
              style={{ width: '100%', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setActionAppId(null); setActionType(null); setActionComments(''); }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={actionLoading}
                onClick={() => actionType === 'return' ? handleReturnForInfo(actionAppId) : handleReject(actionAppId)}
              >
                {actionType === 'return' ? 'Send back to applicant' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
