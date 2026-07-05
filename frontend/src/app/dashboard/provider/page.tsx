'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, uploadFile, downloadBlob } from '@/lib/api';
import { PRODUCT_LABELS } from '@credpriv/shared';
import { FileText, Upload, AlertTriangle, Clock, Check, X, Shield } from 'lucide-react';

interface StaffSubtype {
  id: string;
  code: string;
  name: string;
  parentGroup?: string;
}

interface StaffCategory {
  id: string;
  code: string;
  name: string;
  requiresCommitteeReview?: boolean;
  subtypes: StaffSubtype[];
}

interface JobDescriptionItem {
  id: string;
  name: string;
  code?: string;
  defaultLevel: string;
}

interface JobDescription {
  id: string;
  title: string;
  items: JobDescriptionItem[];
}

interface ClinicalUnitOption {
  id: string;
  clinicalUnit: string;
  label: string;
  title: string;
}

interface PrivilegeRequest {
  id: string;
  jobDescriptionItemId: string;
  requestedLevel: string;
  grantedLevel?: string;
  jobDescriptionItem: JobDescriptionItem;
}

interface Application {
  id: string;
  type: string;
  status: string;
  workflowPhase?: string;
  clinicalUnit?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  currentStage?: string;
  staffCategoryId?: string;
  staffSubtypeId?: string;
  staffCategory?: { name: string; code: string; requiresCommitteeReview?: boolean };
  staffSubtype?: { name: string; code: string };
  jobDescription?: JobDescription;
  privilegeRequests?: PrivilegeRequest[];
}

interface RequiredDoc {
  id: string;
  name: string;
  type: string;
}

interface Document {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
}

interface DocumentComplianceReport {
  complete: boolean;
  requiredCount: number;
  uploadedCount: number;
  missing: Array<{ type: string; name: string }>;
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

const PHASE_LABELS: Record<string, string> = {
  APPOINTMENT: 'Appointment',
  DOCUMENT_UPLOAD: 'Document Upload',
  CREDENTIALING: 'Credentialing',
  PRIVILEGE_REQUEST: 'Privilege Request',
  COMMITTEE_REVIEW: 'Committee Review',
  DEPARTMENT_APPROVAL: 'Department Approval',
  STAFF_CLEARANCE: 'Staff Clearance',
  COMPLETE: 'Complete',
};

const CLINICAL_WORKFLOW = ['APPOINTMENT', 'DOCUMENT_UPLOAD', 'CREDENTIALING', 'PRIVILEGE_REQUEST', 'COMMITTEE_REVIEW', 'COMPLETE'];
const NON_CLINICAL_WORKFLOW = ['APPOINTMENT', 'DOCUMENT_UPLOAD', 'CREDENTIALING', 'DEPARTMENT_APPROVAL', 'STAFF_CLEARANCE', 'COMPLETE'];

function workflowStepsFor(app?: Application | null): string[] {
  const requiresCommittee = app?.staffCategory?.requiresCommitteeReview !== false;
  return requiresCommittee ? CLINICAL_WORKFLOW : NON_CLINICAL_WORKFLOW;
}

const PRIVILEGE_LEVELS = [
  { value: 'FULL', label: 'Full' },
  { value: 'UNDER_SUPERVISION', label: 'Under Supervision' },
  { value: 'NONE', label: 'None' },
];

const WORKFLOW_STEPS = CLINICAL_WORKFLOW;

export default function ProviderDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<StaffCategory[]>([]);
  const [requiredDocs, setRequiredDocs] = useState<RequiredDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [showNewApp, setShowNewApp] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newSubtypeId, setNewSubtypeId] = useState('');
  const [newClinicalUnit, setNewClinicalUnit] = useState('');
  const [clinicalUnits, setClinicalUnits] = useState<ClinicalUnitOption[]>([]);
  const [privilegeLevels, setPrivilegeLevels] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ type: string; name: string } | null>(null);
  const [docCompliance, setDocCompliance] = useState<DocumentComplianceReport | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeApp = applications.find((a) => !['APPROVED', 'DENIED'].includes(a.status));

  const loadData = useCallback(async () => {
    try {
      const [apps, cats] = await Promise.all([
        api<Application[]>('/api/applications'),
        api<StaffCategory[]>('/api/catalog/categories'),
      ]);
      setApplications(apps);
      setCategories(cats);
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

  useEffect(() => {
    if (activeApp?.workflowPhase === 'PRIVILEGE_REQUEST' && !selectedApp?.jobDescription) {
      api<Application>(`/api/applications/${activeApp.id}`).then(setSelectedApp).catch(console.error);
    }
  }, [activeApp?.id, activeApp?.workflowPhase, selectedApp?.jobDescription]);

  useEffect(() => {
    if (!newSubtypeId) {
      setClinicalUnits([]);
      setNewClinicalUnit('');
      return;
    }
    api<ClinicalUnitOption[]>(`/api/catalog/clinical-units/${newSubtypeId}`)
      .then((units) => {
        setClinicalUnits(units);
        if (units.length === 1) {
          setNewClinicalUnit(units[0].clinicalUnit);
        } else {
          setNewClinicalUnit('');
        }
      })
      .catch(() => {
        setClinicalUnits([]);
        setNewClinicalUnit('');
      });
  }, [newSubtypeId]);

  useEffect(() => {
    const app = selectedApp || activeApp;
    if (!app?.staffCategoryId) {
      setRequiredDocs([]);
      return;
    }
    api<RequiredDoc[]>(`/api/catalog/required-documents?categoryId=${app.staffCategoryId}`)
      .then(setRequiredDocs)
      .catch(console.error);
  }, [selectedApp, activeApp]);

  useEffect(() => {
    if (selectedApp?.privilegeRequests) {
      const levels: Record<string, string> = {};
      for (const pr of selectedApp.privilegeRequests) {
        levels[pr.jobDescriptionItemId] = pr.requestedLevel;
      }
      setPrivilegeLevels(levels);
    } else if (selectedApp?.jobDescription?.items) {
      const levels: Record<string, string> = {};
      for (const item of selectedApp.jobDescription.items) {
        levels[item.id] = item.defaultLevel;
      }
      setPrivilegeLevels(levels);
    }
  }, [selectedApp]);

  useEffect(() => {
    const app = selectedApp || activeApp;
    if (!app?.id || !['DOCUMENT_UPLOAD', 'CREDENTIALING'].includes(app.workflowPhase || '')) {
      setDocCompliance(null);
      return;
    }
    api<DocumentComplianceReport>(`/api/applications/${app.id}/document-compliance`)
      .then(setDocCompliance)
      .catch(() => setDocCompliance(null));
  }, [selectedApp?.id, activeApp?.id, activeApp?.workflowPhase, selectedApp?.workflowPhase]);

  function showMessage(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function openApplication(app: Application) {
    try {
      const full = await api<Application>(`/api/applications/${app.id}`);
      setSelectedApp(full);
    } catch {
      setSelectedApp(app);
    }
  }

  async function handleCreateApplication() {
    if (!newCategoryId || !newSubtypeId) {
      showMessage('error', 'Select your category and role');
      return;
    }
    if (clinicalUnits.length > 1 && newClinicalUnit === '' && clinicalUnits.some((u) => u.clinicalUnit)) {
      showMessage('error', 'Select your clinical unit (e.g. Surgery OT or CTVS OT)');
      return;
    }
    setActionLoading(true);
    try {
      const app = await api<Application>('/api/applications', {
        method: 'POST',
        body: {
          type: 'INITIAL_APPOINTMENT',
          staffCategoryId: newCategoryId,
          staffSubtypeId: newSubtypeId,
          clinicalUnit: newClinicalUnit,
        },
      });
      setApplications((prev) => [app, ...prev]);
      setShowNewApp(false);
      setNewCategoryId('');
      setNewSubtypeId('');
      setNewClinicalUnit('');
      setClinicalUnits([]);
      showMessage('success', 'Appointment application created — select role saved');
      openApplication(app);
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
      setSelectedApp((prev) => (prev?.id === id ? { ...prev, ...updated } : prev));
      showMessage('success', 'Submitted — upload your education documents');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSavePrivileges(id: string) {
    const requests = Object.entries(privilegeLevels).map(([jobDescriptionItemId, requestedLevel]) => ({
      jobDescriptionItemId,
      requestedLevel,
    }));
    setActionLoading(true);
    try {
      const updated = await api<Application>(`/api/applications/${id}/privilege-requests`, {
        method: 'PUT',
        body: { requests },
      });
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setSelectedApp(updated);
      showMessage('success', 'Privilege requests saved');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to save privileges');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubmitPrivileges(id: string) {
    setActionLoading(true);
    try {
      await handleSavePrivileges(id);
      const updated = await api<Application>(`/api/applications/${id}/submit-privileges`, { method: 'POST' });
      setApplications((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setSelectedApp(updated);
      showMessage('success', 'Privileges submitted to committee');
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Failed to submit privileges');
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
      showMessage('success', `${pendingUpload.name} uploaded`);
      const app = selectedApp || activeApp;
      if (app?.id) {
        api<DocumentComplianceReport>(`/api/applications/${app.id}/document-compliance`)
          .then(setDocCompliance)
          .catch(() => undefined);
      }
    } catch (err) {
      showMessage('error', err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setActionLoading(false);
      setPendingUpload(null);
    }
  }

  const uploadedTypes = new Set(documents.map((d) => d.type));
  const docApp = selectedApp || activeApp;
  const showDocUpload = docApp && ['DOCUMENT_UPLOAD', 'CREDENTIALING'].includes(docApp.workflowPhase || '');
  const privilegeApp = selectedApp?.workflowPhase === 'PRIVILEGE_REQUEST' ? selectedApp : activeApp?.workflowPhase === 'PRIVILEGE_REQUEST' ? selectedApp : null;
  const showPrivilegeRequest = privilegeApp?.workflowPhase === 'PRIVILEGE_REQUEST' && !!privilegeApp?.jobDescription;
  const selectedSubtypes = categories.find((c) => c.id === newCategoryId)?.subtypes ?? [];
  const selectedCategory = categories.find((c) => c.id === newCategoryId);
  const activeWorkflowSteps = workflowStepsFor(activeApp);
  const showStaffClearanceWait = activeApp?.workflowPhase === 'STAFF_CLEARANCE';
  const showDepartmentApprovalWait = activeApp?.workflowPhase === 'DEPARTMENT_APPROVAL';

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display: 'none' }} onChange={handleFileSelected} />

      {message && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000, padding: '0.75rem 1.25rem', borderRadius: '8px', background: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)', color: 'white', fontSize: '0.875rem' }}>
          {message.text}
        </div>
      )}

      <div className="section-header">
        <h2>{PRODUCT_LABELS.myDashboard}</h2>
        <button type="button" className="btn btn-primary" onClick={() => setShowNewApp(true)} disabled={actionLoading || !!activeApp}>
          <FileText size={16} />
          New Appointment
        </button>
      </div>

      {activeApp?.workflowPhase && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.75rem' }}>Credentialing Journey</h4>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {activeWorkflowSteps.map((step, i) => {
              const current = activeWorkflowSteps.indexOf(activeApp.workflowPhase || 'APPOINTMENT');
              const done = i < current;
              const active = i === current;
              return (
                <div key={step} style={{ flex: '1 1 120px', textAlign: 'center', padding: '0.5rem', borderRadius: 6, fontSize: '0.7rem', background: active ? 'var(--color-primary)' : done ? 'var(--color-success)' : 'var(--color-bg)', color: active || done ? 'white' : 'var(--color-text-muted)' }}>
                  {PHASE_LABELS[step]}
                </div>
              );
            })}
          </div>
          {activeApp.staffSubtype && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Role: <strong>{activeApp.staffCategory?.name}</strong> — {activeApp.staffSubtype.name}
              {activeApp.clinicalUnit ? ` · ${activeApp.clinicalUnit}` : ''}
              {activeApp.staffCategory?.requiresCommitteeReview === false && (
                <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>No committee review</span>
              )}
            </p>
          )}
        </div>
      )}

      {showDepartmentApprovalWait && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-warning, #f0ad4e)' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Awaiting Department Head Approval</h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Your documents have been verified by credentialing staff. Your department head must approve before final clearance.
          </p>
        </div>
      )}

      {showStaffClearanceWait && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--color-primary)' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Awaiting Staff Clearance</h4>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            Your documents have been verified. Credentialing staff will complete your onboarding approval — this role does not go through the credentialing committee.
          </p>
        </div>
      )}

      <div className="card-grid">
        <div className="stat-card"><div className="label">Active Applications</div><div className="value">{applications.filter((a) => !['APPROVED', 'DENIED'].includes(a.status)).length}</div></div>
        <div className="stat-card"><div className="label"><Clock size={14} style={{ display: 'inline' }} /> Phase</div><div className="value" style={{ fontSize: '1rem' }}>{activeApp?.workflowPhase ? PHASE_LABELS[activeApp.workflowPhase] : '—'}</div></div>
        <div className="stat-card"><div className="label"><Upload size={14} style={{ display: 'inline' }} /> Documents</div><div className="value">{documents.length}</div></div>
        <div className="stat-card"><div className="label"><Shield size={14} style={{ display: 'inline' }} /> Privileges</div><div className="value">{activeApp?.privilegeRequests?.length ?? 0}</div></div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>My Applications</h3>
        {loading ? <p>Loading...</p> : applications.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No applications yet. Start a new appointment to begin credentialing.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Role</th><th>Unit</th><th>Phase</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td>{app.staffSubtype?.name ?? '—'}</td>
                  <td>{app.clinicalUnit || '—'}</td>
                  <td>{app.workflowPhase ? PHASE_LABELS[app.workflowPhase] : '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[app.status] || 'badge-neutral'}`}>{app.status}</span></td>
                  <td>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '—'}</td>
                  <td><button type="button" className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem' }} onClick={() => openApplication(app)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(showDocUpload || requiredDocs.length > 0) && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Education & Credential Documents</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Upload 10th, 12th, degree certificates, medical/nursing license, and government ID as required for your role.
          </p>
          {docCompliance && (
            <p style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
              Progress: <strong>{docCompliance.uploadedCount}/{docCompliance.requiredCount}</strong> required documents uploaded
              {docCompliance.complete ? (
                <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>Ready for staff review</span>
              ) : (
                <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>{docCompliance.missing.length} missing</span>
              )}
            </p>
          )}
          <div style={{ marginTop: '1rem' }}>
            {(requiredDocs.length > 0 ? requiredDocs : []).map((doc) => {
              const uploaded = uploadedTypes.has(doc.type);
              return (
                <div key={doc.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {uploaded && <Check size={16} style={{ color: 'var(--color-success)' }} />}
                    {doc.name}
                  </span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => triggerUpload(doc.type, doc.name)} disabled={actionLoading || !showDocUpload}>
                    <Upload size={14} /> {uploaded ? 'Replace' : 'Upload'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showPrivilegeRequest && privilegeApp?.jobDescription && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.5rem' }}>Request Privileges — {privilegeApp.jobDescription.title}</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Select requested privilege level for each item in your job description (Full / Under Supervision / None).
          </p>
          {privilegeApp.jobDescription.items.map((item) => (
            <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '1rem', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <div>
                <strong style={{ fontSize: '0.875rem' }}>{item.name}</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Suggested: {PRIVILEGE_LEVELS.find((l) => l.value === item.defaultLevel)?.label}</div>
              </div>
              <select className="form-input" value={privilegeLevels[item.id] || item.defaultLevel} onChange={(e) => setPrivilegeLevels((prev) => ({ ...prev, [item.id]: e.target.value }))}>
                {PRIVILEGE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          ))}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => handleSavePrivileges(privilegeApp.id)} disabled={actionLoading}>Save Draft</button>
            <button type="button" className="btn btn-primary" onClick={() => handleSubmitPrivileges(privilegeApp.id)} disabled={actionLoading}>Submit to Committee</button>
          </div>
        </div>
      )}

      {showNewApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={() => setShowNewApp(false)}>
          <div className="card" style={{ width: '100%', maxWidth: '480px', margin: '1rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>New Appointment Application</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Select your staff category and role. Clinical roles go through committee review; administrative and support staff are cleared by credentialing staff only.
            </p>
            {selectedCategory?.requiresCommitteeReview === false && (
              <p style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', background: 'var(--color-bg)', borderRadius: 6, marginBottom: '1rem' }}>
                <strong>{selectedCategory.name}</strong> roles do not require privilege matrices or credentialing committee review.
              </p>
            )}
            <div className="form-group">
              <label>Category</label>
              <select className="form-input" value={newCategoryId} onChange={(e) => { setNewCategoryId(e.target.value); setNewSubtypeId(''); }}>
                <option value="">Select category...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Role</label>
              <select className="form-input" value={newSubtypeId} onChange={(e) => setNewSubtypeId(e.target.value)} disabled={!newCategoryId}>
                <option value="">Select role...</option>
                {selectedSubtypes.map((s) => <option key={s.id} value={s.id}>{s.parentGroup ? `${s.parentGroup} — ` : ''}{s.name}</option>)}
              </select>
            </div>
            {clinicalUnits.length > 1 && (
              <div className="form-group">
                <label>Clinical Unit</label>
                <select className="form-input" value={newClinicalUnit} onChange={(e) => setNewClinicalUnit(e.target.value)}>
                  <option value="">Select unit...</option>
                  {clinicalUnits.map((u) => (
                    <option key={u.id} value={u.clinicalUnit}>{u.label}{u.clinicalUnit ? '' : ''}</option>
                  ))}
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                  e.g. Surgery OT vs CTVS OT — determines which job description applies.
                </p>
              </div>
            )}
            <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreateApplication} disabled={actionLoading}>Create Application</button>
          </div>
        </div>
      )}

      {selectedApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={() => setSelectedApp(null)}>
          <div className="card" style={{ width: '100%', maxWidth: '520px', margin: '1rem', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3>Application Details</h3>
              <button type="button" onClick={() => setSelectedApp(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <dl style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem 1rem', fontSize: '0.875rem' }}>
              <dt style={{ color: 'var(--color-text-muted)' }}>Role</dt>
              <dd>{selectedApp.staffSubtype?.name ?? 'Not selected'}</dd>
              {selectedApp.clinicalUnit && (
                <>
                  <dt style={{ color: 'var(--color-text-muted)' }}>Clinical Unit</dt>
                  <dd>{selectedApp.clinicalUnit}</dd>
                </>
              )}
              <dt style={{ color: 'var(--color-text-muted)' }}>Phase</dt>
              <dd>{selectedApp.workflowPhase ? PHASE_LABELS[selectedApp.workflowPhase] : '—'}</dd>
              <dt style={{ color: 'var(--color-text-muted)' }}>Status</dt>
              <dd><span className={`badge ${STATUS_BADGE[selectedApp.status] || 'badge-neutral'}`}>{selectedApp.status}</span></dd>
            </dl>
            {(selectedApp.status === 'DRAFT' || selectedApp.status === 'NEEDS_INFO') && (
              <button type="button" className="btn btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => handleSubmitApplication(selectedApp.id)} disabled={actionLoading}>
                Submit & Begin Document Upload
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
