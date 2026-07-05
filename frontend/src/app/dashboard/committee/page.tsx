'use client';

import { useEffect, useState } from 'react';
import { api, downloadBlob } from '@/lib/api';
import { PRODUCT_LABELS } from '@credpriv/shared';
import { Download } from 'lucide-react';

interface PrivilegeRequest {
  id: string;
  jobDescriptionItemId: string;
  requestedLevel: string;
  grantedLevel?: string;
  jobDescriptionItem: { name: string };
}

interface CommitteeApplication {
  id: string;
  workflowPhase: string;
  status: string;
  clinicalUnit?: string;
  provider: {
    user: { firstName: string; lastName: string };
    profile?: { staffSubtype?: { name: string } };
  };
  staffSubtype?: { name: string };
  jobDescription?: { title: string };
  privilegeRequests: PrivilegeRequest[];
}

interface Meeting {
  id: string;
  title: string;
  scheduledAt: string;
  status: string;
  minutesSentAt?: string | null;
  committee: { name: string; type: string };
  reviews: Array<{
    id: string;
    status: string;
    application: {
      provider: {
        user: { firstName: string; lastName: string };
        profile?: { specialty?: { name: string } };
      };
    };
    decisions: Array<{ decisionType: string }>;
  }>;
}

export default function CommitteeDashboard() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [committeeApps, setCommitteeApps] = useState<CommitteeApplication[]>([]);
  const [selectedReview, setSelectedReview] = useState<string | null>(null);
  const [grantApp, setGrantApp] = useState<CommitteeApplication | null>(null);
  const [momMeetingId, setMomMeetingId] = useState<string | null>(null);

  function reloadMeetings() {
    api<Meeting[]>('/api/committees/meetings').then(setMeetings).catch(console.error);
  }

  useEffect(() => {
    reloadMeetings();
    api<CommitteeApplication[]>('/api/applications?committeeReady=true')
      .then((apps) => setCommitteeApps(apps.filter((a) => a.workflowPhase === 'COMMITTEE_REVIEW')))
      .catch(console.error);
  }, []);

  return (
    <div>
      <div className="section-header">
        <h2>Committee Dashboard</h2>
      </div>

      <div className="card-grid">
        <div className="stat-card">
          <div className="label">Upcoming Meetings</div>
          <div className="value">{meetings.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Cases Pending Review</div>
          <div className="value">
            {committeeApps.length || meetings.reduce((sum, m) => sum + m.reviews.filter((r) => r.status === 'PENDING').length, 0)}
          </div>
        </div>
      </div>

      {committeeApps.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Privilege Grant Queue</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            Review requested privileges and grant Full / Under Supervision / None per job description item.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>{PRODUCT_LABELS.applicantSingular}</th>
                <th>Role</th>
                <th>Unit</th>
                <th>Job Description</th>
                <th>Items</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {committeeApps.map((app) => (
                <tr key={app.id}>
                  <td>{app.provider.user.firstName} {app.provider.user.lastName}</td>
                  <td>{app.staffSubtype?.name ?? app.provider.profile?.staffSubtype?.name ?? '—'}</td>
                  <td>{app.clinicalUnit || '—'}</td>
                  <td>{app.jobDescription?.title ?? '—'}</td>
                  <td>{app.privilegeRequests?.length ?? 0}</td>
                  <td>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem', marginRight: '0.5rem' }} onClick={async () => {
                      try {
                        const review = await api<{ id: string }>(`/api/committees/reviews/by-application/${app.id}`);
                        setSelectedReview(review.id);
                      } catch {
                        alert('No committee review found — provider may need to submit privileges first.');
                      }
                    }}>
                      Review Packet
                    </button>
                    <button type="button" className="btn btn-primary" style={{ padding: '0.375rem 0.75rem' }} onClick={async () => {
                      const full = await api<CommitteeApplication>(`/api/applications/${app.id}`);
                      setGrantApp(full);
                    }}>
                      Grant Privileges
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meetings.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--color-text-muted)' }}>No upcoming committee meetings scheduled.</p>
        </div>
      ) : (
        meetings.map((meeting) => (
          <div key={meeting.id} className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <h3>{meeting.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  {meeting.committee.name} · {new Date(meeting.scheduledAt).toLocaleString()}
                  {meeting.minutesSentAt && (
                    <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>MoM Sent</span>
                  )}
                </p>
              </div>
              {!meeting.minutesSentAt && meeting.status !== 'CANCELLED' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setMomMeetingId(meeting.id)}
                >
                  Conclude & Send MoM
                </button>
              )}
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>{PRODUCT_LABELS.applicantSingular}</th>
                  <th>Specialty</th>
                  <th>Status</th>
                  <th>Decision</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {meeting.reviews.map((review) => (
                  <tr key={review.id}>
                    <td>Dr. {review.application.provider.user.firstName} {review.application.provider.user.lastName}</td>
                    <td>{review.application.provider.profile?.specialty?.name ?? '—'}</td>
                    <td><span className="badge badge-warning">{review.status}</span></td>
                    <td>
                      {review.decisions.length > 0
                        ? review.decisions[0].decisionType
                        : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.375rem 0.75rem' }}
                        onClick={() => setSelectedReview(review.id)}
                      >
                        Review Packet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {selectedReview && (
        <ReviewPacketModal reviewId={selectedReview} onClose={() => setSelectedReview(null)} />
      )}

      {grantApp && (
        <PrivilegeGrantModal app={grantApp} onClose={() => setGrantApp(null)} onGranted={() => {
          setGrantApp(null);
          api<CommitteeApplication[]>('/api/applications?committeeReady=true')
            .then((apps) => setCommitteeApps(apps.filter((a) => a.workflowPhase === 'COMMITTEE_REVIEW')))
            .catch(console.error);
        }} />
      )}

      {momMeetingId && (
        <MinutesOfMeetingModal
          meetingId={momMeetingId}
          onClose={() => setMomMeetingId(null)}
          onSent={() => {
            setMomMeetingId(null);
            reloadMeetings();
          }}
        />
      )}
    </div>
  );
}

const PRIVILEGE_LEVELS = [
  { value: 'FULL', label: 'Full' },
  { value: 'UNDER_SUPERVISION', label: 'Under Supervision' },
  { value: 'NONE', label: 'None' },
];

function PrivilegeGrantModal({
  app,
  onClose,
  onGranted,
}: {
  app: CommitteeApplication;
  onClose: () => void;
  onGranted: () => void;
}) {
  const [grants, setGrants] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const pr of app.privilegeRequests || []) {
      initial[pr.jobDescriptionItemId] = pr.grantedLevel || pr.requestedLevel;
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitGrants() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/applications/${app.id}/grant-privileges`, {
        method: 'POST',
        body: {
          grants: Object.entries(grants).map(([jobDescriptionItemId, grantedLevel]) => ({
            jobDescriptionItemId,
            grantedLevel,
          })),
        },
      });
      onGranted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant privileges');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="card" style={{ width: '90%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: '0.5rem' }}>Grant Privileges</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          {app.provider.user.firstName} {app.provider.user.lastName} — {app.jobDescription?.title}
        </p>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</p>}
        {(app.privilegeRequests || []).map((pr) => (
          <div key={pr.id} style={{ display: 'grid', gridTemplateColumns: '1fr 140px 160px', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
            <span>{pr.jobDescriptionItem.name}</span>
            <span style={{ color: 'var(--color-text-muted)' }}>Requested: {pr.requestedLevel.replace(/_/g, ' ')}</span>
            <select className="form-input" value={grants[pr.jobDescriptionItemId]} onChange={(e) => setGrants((prev) => ({ ...prev, [pr.jobDescriptionItemId]: e.target.value }))}>
              {PRIVILEGE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        ))}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submitGrants} disabled={saving}>Confirm Grant</button>
        </div>
      </div>
    </div>
  );
}

function MinutesOfMeetingModal({
  meetingId,
  onClose,
  onSent,
}: {
  meetingId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  interface MomMember {
    id: string;
    role: string;
    designation?: string | null;
    displayName: string;
    email: string | null;
  }

  interface MomMeeting {
    title: string;
    scheduledAt: string;
    minutes?: string | null;
    committee: { name: string; members: MomMember[] };
  }

  const [meeting, setMeeting] = useState<MomMeeting | null>(null);
  const [minutes, setMinutes] = useState('');
  const [presentIds, setPresentIds] = useState<string[]>([]);
  const [additionalEmails, setAdditionalEmails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<MomMeeting>(`/api/committees/meetings/${meetingId}`)
      .then((m) => {
        setMeeting(m);
        if (m.minutes) setMinutes(m.minutes);
        setPresentIds(m.committee.members.filter((mem) => mem.email).map((mem) => mem.id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load meeting'));
  }, [meetingId]);

  function togglePresent(id: string) {
    setPresentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submitMom() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/committees/meetings/${meetingId}/conclude-minutes`, {
        method: 'POST',
        body: {
          minutes,
          presentMemberIds: presentIds,
          additionalEmails: additionalEmails
            .split(/[,;\n]/)
            .map((e) => e.trim())
            .filter(Boolean),
        },
      });
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send minutes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div className="card" style={{ width: '90%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: '0.5rem' }}>Minutes of Meeting</h3>
        {meeting && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
            {meeting.committee.name} — {meeting.title} · {new Date(meeting.scheduledAt).toLocaleString()}
          </p>
        )}
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</p>}

        <div className="form-group">
          <label>Minutes text</label>
          <textarea
            className="form-input"
            rows={8}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="Record decisions, attendees, and action items..."
          />
        </div>

        <div className="form-group">
          <label>Members present (MoM will be sent to selected members with accounts + additional emails below)</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {(meeting?.committee.members || []).map((m) => (
              <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={presentIds.includes(m.id)} onChange={() => togglePresent(m.id)} />
                <span>
                  {m.displayName}
                  {m.designation ? ` — ${m.designation}` : ''}
                  {m.email ? ` (${m.email})` : ' (no login — add email below if needed)'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Additional recipients (comma-separated emails)</label>
          <input
            className="form-input"
            value={additionalEmails}
            onChange={(e) => setAdditionalEmails(e.target.value)}
            placeholder="e.g. ceo@hospital.org, medical.director@hospital.org"
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submitMom} disabled={saving || !minutes.trim() || presentIds.length === 0}>
            {saving ? 'Sending…' : 'Prepare & Send MoM'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewPacketModal({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  interface ReviewPacket {
    summary: {
      providerId: string;
      providerName: string;
      email: string;
      npi?: string;
      licenseNo?: string;
      department?: string;
      specialty?: string;
      staffCategory?: string;
      staffSubtype?: string;
      clinicalUnit?: string | null;
      applicationType: string;
      workflowPhase: string;
      status: string;
      submittedAt?: string;
    };
    flags: Array<{ severity: string; code: string; message: string }>;
    documentCompliance: { complete: boolean; uploadedCount: number; requiredCount: number; missing: Array<{ name: string }> };
    documents: Array<{ name: string; type: string; uploadedAt: string }>;
    credentials: Array<{ title: string; type: string; status: string; expiryDate?: string; psv: Array<{ status: string; source?: string }> }>;
    backgroundVerifications: Array<{
      verificationType: string;
      verifierType: string;
      status: string;
      performedBy?: string | null;
      thirdParty?: { name: string; address?: string; mouReference?: string } | null;
      findings?: string;
    }>;
    documentChecklist: Array<{ type: string; name: string; uploaded: boolean; isRequired: boolean; fileCount?: number; uploadedFiles?: Array<{ id: string; name: string; uploadedAt: string }> }>;
    jobDescription?: {
      title: string;
      clinicalUnit?: string;
      description?: string | null;
      sourceFileName?: string | null;
      itemCount: number;
      items: Array<{ name: string; code?: string | null; description?: string | null; defaultLevel: string }>;
    } | null;
    privilegeMatrix: {
      jobDescriptionTitle?: string;
      items: Array<{ name: string; suggestedLevel: string; requestedLevel?: string | null; grantedLevel?: string | null }>;
    };
    existingPrivileges: Array<{ procedure: string; status: string }>;
    priorApplications: Array<{ type: string; status: string; updatedAt: string }>;
    review: { decisions: Array<{ decisionType: string; rationale?: string }> };
  }

  const [packet, setPacket] = useState<ReviewPacket | null>(null);
  const [aiSummary, setAiSummary] = useState<{ summary: string; flags: Array<{ severity: string; message: string }> } | null>(null);
  const [decision, setDecision] = useState('');
  const [rationale, setRationale] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('summary');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api<ReviewPacket>(`/api/committees/reviews/${reviewId}`).then(setPacket).catch(console.error);
  }, [reviewId]);

  useEffect(() => {
    if (packet?.summary.providerId) {
      api<{ summary: string; flags: Array<{ severity: string; message: string }> }>(
        `/api/committees/ai-summary/${packet.summary.providerId}`
      ).then(setAiSummary).catch(console.error);
    }
  }, [packet?.summary.providerId]);

  async function submitDecision() {
    if (!decision) return;
    try {
      await api(`/api/committees/reviews/${reviewId}/decisions`, {
        method: 'POST',
        body: { decisionType: decision, rationale },
      });
      onClose();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to record decision');
    }
  }

  const sections = [
    { id: 'summary', label: 'Summary' },
    { id: 'documents', label: 'Documents & JD' },
    { id: 'credentials', label: 'Credentials & PSV' },
    { id: 'background', label: 'Background Verification' },
    { id: 'privileges', label: 'Privilege Matrix' },
    { id: 'decision', label: 'Decision' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}
      onClick={onClose}
    >
      <div className="card" style={{ width: '95%', maxWidth: 960, maxHeight: '92vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3>Committee Review Packet</h3>
            {packet && (
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                {packet.summary.providerName} — {packet.summary.staffSubtype}
                {packet.summary.clinicalUnit ? ` · ${packet.summary.clinicalUnit}` : ''}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await downloadBlob(`/api/committees/reviews/${reviewId}/packet.pdf`, `review-packet-${reviewId.slice(0, 8)}.pdf`);
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'PDF download failed');
                } finally {
                  setDownloading(false);
                }
              }}
            >
              <Download size={14} style={{ display: 'inline', marginRight: 4 }} />
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
          </div>
        </div>

        {message && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>{message}</p>}

        {!packet ? (
          <p>Loading review packet...</p>
        ) : (
          <>
            {(packet.flags.length > 0 || aiSummary?.flags.length) && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fff3cd', borderRadius: 8 }}>
                <strong style={{ fontSize: '0.875rem' }}>Review flags</strong>
                <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8rem' }}>
                  {packet.flags.map((f, i) => <li key={`f-${i}`}>{f.message}</li>)}
                  {aiSummary?.flags.map((f, i) => <li key={`ai-${i}`}>{f.message}</li>)}
                </ul>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`btn ${activeSection === s.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
                  onClick={() => setActiveSection(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {activeSection === 'summary' && (
              <div style={{ fontSize: '0.875rem' }}>
                {aiSummary && (
                  <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: 8 }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>AI Case Summary</h4>
                    <p>{aiSummary.summary}</p>
                  </div>
                )}
                <dl style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.4rem 1rem' }}>
                  <dt style={{ color: 'var(--color-text-muted)' }}>Email</dt><dd>{packet.summary.email}</dd>
                  <dt style={{ color: 'var(--color-text-muted)' }}>NPI / License</dt><dd>{packet.summary.npi || '—'} / {packet.summary.licenseNo || '—'}</dd>
                  <dt style={{ color: 'var(--color-text-muted)' }}>Department</dt><dd>{packet.summary.department || '—'}</dd>
                  <dt style={{ color: 'var(--color-text-muted)' }}>Specialty</dt><dd>{packet.summary.specialty || '—'}</dd>
                  <dt style={{ color: 'var(--color-text-muted)' }}>Application</dt><dd>{packet.summary.applicationType} · {packet.summary.status}</dd>
                  <dt style={{ color: 'var(--color-text-muted)' }}>Submitted</dt><dd>{packet.summary.submittedAt ? new Date(packet.summary.submittedAt).toLocaleDateString() : '—'}</dd>
                </dl>
                {packet.priorApplications.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4 style={{ fontSize: '0.875rem' }}>Prior applications</h4>
                    {packet.priorApplications.map((a, i) => (
                      <div key={i} style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{a.type} — {a.status}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'documents' && (
              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Document checklist &amp; uploads</h4>
                <table className="table" style={{ marginBottom: '1.5rem' }}>
                  <thead><tr><th>Suggested document</th><th>Status</th><th>Files on record</th></tr></thead>
                  <tbody>
                    {(packet.documentChecklist || []).map((item, i) => (
                      <tr key={i}>
                        <td>{item.name}</td>
                        <td>
                          <span className={`badge ${item.uploaded ? 'badge-success' : 'badge-warning'}`}>
                            {item.uploaded ? `Uploaded${item.fileCount && item.fileCount > 1 ? ` (${item.fileCount})` : ''}` : 'Not uploaded'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {item.uploadedFiles && item.uploadedFiles.length > 0 ? (
                            <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                              {item.uploadedFiles.map((f) => (
                                <li key={f.id}>{f.name} — {new Date(f.uploadedAt).toLocaleDateString()}</li>
                              ))}
                            </ul>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>— ask applicant if needed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>All uploaded files</h4>
                <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                  {packet.documentCompliance.uploadedCount}/{packet.documentCompliance.requiredCount} required documents on file
                </p>
                <table className="table" style={{ marginBottom: '1.5rem' }}>
                  <thead><tr><th>Document</th><th>Type</th><th>Uploaded</th></tr></thead>
                  <tbody>
                    {packet.documents.map((d, i) => (
                      <tr key={i}><td>{d.name}</td><td>{d.type}</td><td>{new Date(d.uploadedAt).toLocaleDateString()}</td></tr>
                    ))}
                  </tbody>
                </table>

                {packet.jobDescription && (
                  <>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Job description — {packet.jobDescription.title}</h4>
                    {packet.jobDescription.clinicalUnit && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Unit: {packet.jobDescription.clinicalUnit}</p>
                    )}
                    {packet.jobDescription.sourceFileName && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Source file: {packet.jobDescription.sourceFileName}</p>
                    )}
                    {packet.jobDescription.description && (
                      <p style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>{packet.jobDescription.description}</p>
                    )}
                    <table className="table">
                      <thead><tr><th>Privilege item</th><th>Suggested</th></tr></thead>
                      <tbody>
                        {packet.jobDescription.items.map((item, i) => (
                          <tr key={i}>
                            <td>
                              <strong>{item.name}</strong>
                              {item.description && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.description}</div>}
                            </td>
                            <td>{item.defaultLevel.replace(/_/g, ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}

            {activeSection === 'credentials' && (
              <div>
                {packet.credentials.map((c, i) => (
                  <div key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                    <strong>{c.title}</strong> — <span className={`badge badge-${c.status === 'VERIFIED' ? 'success' : 'warning'}`}>{c.status}</span>
                    {c.expiryDate && <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)' }}>Exp: {new Date(c.expiryDate).toLocaleDateString()}</span>}
                    {c.psv.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        PSV: {c.psv.map((p) => `${p.status}${p.source ? ` (${p.source})` : ''}`).join('; ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeSection === 'background' && (
              <div>
                {packet.backgroundVerifications.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>No background verification on file.</p>
                ) : (
                  packet.backgroundVerifications.map((bv, i) => (
                    <div key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>{bv.verificationType.replace(/_/g, ' ')}</strong>
                        <span className={`badge ${bv.status === 'CLEAR' ? 'badge-success' : bv.status === 'ADVERSE' ? 'badge-danger' : 'badge-warning'}`}>{bv.status}</span>
                      </div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        {bv.verifierType === 'HOSPITAL' ? `Hospital — ${bv.performedBy || 'staff'}` : `Third party — ${bv.thirdParty?.name || '—'}`}
                      </div>
                      {bv.thirdParty?.address && <div style={{ fontSize: '0.75rem' }}>{bv.thirdParty.address}</div>}
                      {bv.thirdParty?.mouReference && <div style={{ fontSize: '0.75rem' }}>MOU: {bv.thirdParty.mouReference}</div>}
                      {bv.findings && <div style={{ marginTop: '0.25rem' }}>Findings: {bv.findings}</div>}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeSection === 'privileges' && (
              <div>
                <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>{packet.privilegeMatrix.jobDescriptionTitle}</p>
                <table className="table">
                  <thead><tr><th>Privilege item</th><th>Suggested</th><th>Requested</th><th>Granted</th></tr></thead>
                  <tbody>
                    {packet.privilegeMatrix.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.name}</td>
                        <td>{item.suggestedLevel.replace(/_/g, ' ')}</td>
                        <td>{item.requestedLevel?.replace(/_/g, ' ') || '—'}</td>
                        <td>{item.grantedLevel?.replace(/_/g, ' ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {packet.existingPrivileges.length > 0 && (
                  <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    <strong>Existing privileges:</strong> {packet.existingPrivileges.map((p) => p.procedure).join(', ')}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'decision' && (
              <div>
                <div className="form-group">
                  <label>Decision</label>
                  <select className="form-input" value={decision} onChange={(e) => setDecision(e.target.value)}>
                    <option value="">Select decision...</option>
                    <option value="APPROVE">Approve</option>
                    <option value="DENY">Deny</option>
                    <option value="DEFER">Defer</option>
                    <option value="RETURN_FOR_INFO">Return for Info</option>
                    <option value="GRANT_TEMPORARY">Grant Temporary</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Rationale</label>
                  <textarea className="form-input" rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Document decision rationale..." />
                </div>
                <button type="button" className="btn btn-primary" onClick={submitDecision} disabled={!decision}>
                  Record Decision
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
