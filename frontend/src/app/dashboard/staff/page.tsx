'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, downloadBlob } from '@/lib/api';
import { PRODUCT_LABELS } from '@credpriv/shared';
import { Download } from 'lucide-react';
import { X } from 'lucide-react';
import JobDescriptionsPanel from '@/components/admin/JobDescriptionsPanel';
import CommitteesPanel from '@/components/admin/CommitteesPanel';
import BackgroundVerificationPanel from '@/components/staff/BackgroundVerificationPanel';
import ApplicationDocumentInventory from '@/components/shared/ApplicationDocumentInventory';

interface Queues {
  newApplications: number;
  pendingDocuments: number;
  pendingPsv: number;
  committeeReady: number;
  privilegePending?: number;
  staffClearancePending?: number;
  departmentApprovalPending?: number;
}

interface Application {
  id: string;
  type: string;
  status: string;
  workflowPhase?: string;
  clinicalUnit?: string;
  committeeReady: boolean;
  submittedAt?: string;
  createdAt: string;
  provider: {
    user: { firstName: string; lastName: string };
    profile?: {
      department?: { name: string };
      specialty?: { name: string };
      staffCategory?: { name: string; requiresCommitteeReview?: boolean };
      staffSubtype?: { name: string };
    };
  };
  staffCategory?: { name: string; requiresCommitteeReview?: boolean };
  staffSubtype?: { name: string };
}

interface DocumentComplianceReport {
  complete: boolean;
  gateEnforced?: boolean;
  requiredCount: number;
  uploadedCount: number;
  missing: Array<{ type: string; name: string }>;
  items?: Array<{ type: string; name: string; uploaded?: boolean }>;
}

export default function StaffDashboard() {
  const [activeTab, setActiveTab] = useState<'workflow' | 'job-descriptions' | 'committees'>('workflow');
  const [queues, setQueues] = useState<Queues | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [docCompliance, setDocCompliance] = useState<DocumentComplianceReport | null>(null);
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

  useEffect(() => {
    if (!selectedApp) {
      setDocCompliance(null);
      return;
    }
    api<DocumentComplianceReport>(`/api/applications/${selectedApp.id}/document-compliance`)
      .then(setDocCompliance)
      .catch(() => setDocCompliance(null));
  }, [selectedApp?.id]);

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function handleCompleteCredentialing(id: string, requiresCommittee?: boolean) {
    setActionLoading(true);
    try {
      const updated = await api<Application>(`/api/applications/${id}/complete-credentialing`, { method: 'POST' });
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
      if (selectedApp?.id === id) setSelectedApp(updated);
      const q = await api<Queues>('/api/applications/queues');
      setQueues(q);
      showMessage(
        'success',
        requiresCommittee === false
          ? 'Credentialing complete — awaiting department head approval'
          : 'Credentialing complete — applicant can request privileges'
      );
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApproveClearance(id: string) {
    setActionLoading(true);
    try {
      const updated = await api<Application>(`/api/applications/${id}/approve-staff-clearance`, { method: 'POST' });
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
      if (selectedApp?.id === id) setSelectedApp(updated);
      const q = await api<Queues>('/api/applications/queues');
      setQueues(q);
      showMessage('success', 'Staff clearance approved — onboarding complete');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
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

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'workflow' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('workflow')}
        >
          Application Workflow
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'job-descriptions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('job-descriptions')}
        >
          Job Descriptions
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'committees' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('committees')}
        >
          Committees
        </button>
      </div>

      {activeTab === 'committees' && <CommitteesPanel />}

      {activeTab === 'job-descriptions' && <JobDescriptionsPanel />}

      {activeTab === 'workflow' && (
      <>
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
        <div className="queue-card">
          <div className="count">{queues?.privilegePending ?? '—'}</div>
          <div className="title">Awaiting Privilege Request</div>
        </div>
        <div className="queue-card">
          <div className="count">{queues?.departmentApprovalPending ?? '—'}</div>
          <div className="title">Dept Head Approval</div>
        </div>
        <div className="queue-card">
          <div className="count">{queues?.staffClearancePending ?? '—'}</div>
          <div className="title">Staff Clearance</div>
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
                <th>{PRODUCT_LABELS.applicantSingular}</th>
                <th>Role</th>
                <th>Unit</th>
                <th>Phase</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>{app.provider.user.firstName} {app.provider.user.lastName}</td>
                  <td>{app.staffSubtype?.name ?? app.provider.profile?.staffSubtype?.name ?? '—'}</td>
                  <td>{app.clinicalUnit || '—'}</td>
                  <td>{app.workflowPhase?.replace(/_/g, ' ') ?? '—'}</td>
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
                    {['DOCUMENT_UPLOAD', 'CREDENTIALING'].includes(app.workflowPhase || '') && app.status !== 'APPROVED' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.375rem 0.75rem' }}
                        onClick={async () => {
                          setSelectedApp(app);
                        }}
                        disabled={actionLoading}
                      >
                        Review Docs
                      </button>
                    )}
                    {!app.committeeReady && app.status === 'UNDER_VERIFICATION' && !app.workflowPhase && (
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
                    {app.workflowPhase === 'STAFF_CLEARANCE' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.375rem 0.75rem', marginLeft: '0.5rem' }}
                        onClick={() => handleApproveClearance(app.id)}
                        disabled={actionLoading}
                      >
                        Approve Clearance
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
              <dt style={{ color: 'var(--color-text-muted)' }}>Applicant</dt>
              <dd>{selectedApp.provider.user.firstName} {selectedApp.provider.user.lastName}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Role</dt>
              <dd>{selectedApp.staffSubtype?.name ?? selectedApp.provider.profile?.staffSubtype?.name ?? '—'}</dd>
              {selectedApp.clinicalUnit && (
                <>
                  <dt style={{ color: 'var(--color-text-muted)' }}>Clinical Unit</dt>
                  <dd>{selectedApp.clinicalUnit}</dd>
                </>
              )}
              <dt style={{ color: 'var(--color-text-muted)' }}>Phase</dt>
              <dd>{selectedApp.workflowPhase?.replace(/_/g, ' ') ?? '—'}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Status</dt>
              <dd>{selectedApp.status}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Committee Ready</dt>
              <dd>{selectedApp.committeeReady ? 'Yes' : 'No'}</dd>
              {docCompliance && (
                <>
                  <dt style={{ color: 'var(--color-text-muted)' }}>Documents</dt>
                  <dd>
                    {docCompliance.uploadedCount}/{docCompliance.items?.length ?? docCompliance.requiredCount} on file
                    {docCompliance.gateEnforced === false ? (
                      <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>Optional uploads</span>
                    ) : docCompliance.complete ? (
                      <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Complete</span>
                    ) : (
                      <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>Incomplete</span>
                    )}
                  </dd>
                </>
              )}
            </dl>
            {docCompliance && docCompliance.gateEnforced !== false && !docCompliance.complete && docCompliance.missing.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 8, fontSize: '0.875rem' }}>
                <strong>Missing required documents:</strong>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                  {docCompliance.missing.map((m) => (
                    <li key={m.type}>{m.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {docCompliance && docCompliance.gateEnforced === false && docCompliance.missing.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 8, fontSize: '0.875rem' }}>
                <strong>Not yet uploaded (optional for now):</strong>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                  {docCompliance.missing.map((m) => (
                    <li key={m.type}>{m.name}</li>
                  ))}
                </ul>
              </div>
            )}
            {['DOCUMENT_UPLOAD', 'CREDENTIALING'].includes(selectedApp.workflowPhase || '') && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '1.5rem', width: '100%' }}
                onClick={() => handleCompleteCredentialing(
                  selectedApp.id,
                  selectedApp.staffCategory?.requiresCommitteeReview ?? selectedApp.provider.profile?.staffCategory?.requiresCommitteeReview
                )}
                disabled={actionLoading || (docCompliance?.gateEnforced === true && docCompliance !== null && !docCompliance.complete)}
              >
                {(selectedApp.staffCategory?.requiresCommitteeReview ?? selectedApp.provider.profile?.staffCategory?.requiresCommitteeReview) === false
                  ? 'Complete Credentialing → Dept Approval'
                  : 'Complete Credentialing → Privilege Request'}
              </button>
            )}
            <ApplicationDocumentInventory applicationId={selectedApp.id} />
            <BackgroundVerificationPanel applicationId={selectedApp.id} />
            {selectedApp.workflowPhase === 'STAFF_CLEARANCE' && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '1.5rem', width: '100%' }}
                onClick={() => handleApproveClearance(selectedApp.id)}
                disabled={actionLoading}
              >
                Approve Staff Clearance (No Committee)
              </button>
            )}
            {['STAFF_CLEARANCE', 'COMPLETE'].includes(selectedApp.workflowPhase || '') && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: '1rem', width: '100%' }}
                onClick={() => downloadBlob(`/api/applications/${selectedApp.id}/onboarding.pdf`, `onboarding-${selectedApp.id.slice(0, 8)}.pdf`)}
              >
                <Download size={14} style={{ display: 'inline', marginRight: 4 }} />
                Download HR Onboarding PDF
              </button>
            )}
            {!selectedApp.committeeReady && selectedApp.status === 'UNDER_VERIFICATION' && !selectedApp.workflowPhase && (
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
      </>
      )}
    </div>
  );
}
