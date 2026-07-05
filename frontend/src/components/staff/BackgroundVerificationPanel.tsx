'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface ThirdPartyVerifier {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  mouReference?: string;
  mouValidFrom?: string;
  mouValidTo?: string;
}

interface BackgroundVerification {
  id: string;
  verificationType: string;
  verifierType: string;
  status: string;
  initiatedAt: string;
  completedAt?: string;
  findings?: string;
  remarks?: string;
  thirdPartyName?: string;
  thirdPartyAddress?: string;
  mouReference?: string;
  performedBy?: { firstName: string; lastName: string };
  thirdPartyVerifier?: ThirdPartyVerifier;
}

const VERIFICATION_TYPES = [
  { value: 'BACKGROUND_CHECK', label: 'Background check' },
  { value: 'CRIMINAL_RECORD', label: 'Criminal record' },
  { value: 'EMPLOYMENT_HISTORY', label: 'Employment history' },
  { value: 'REFERENCE_CHECK', label: 'Reference check' },
  { value: 'PSV', label: 'Primary source verification' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'CLEAR', label: 'Clear' },
  { value: 'ADVERSE', label: 'Adverse' },
  { value: 'INCONCLUSIVE', label: 'Inconclusive' },
];

export default function BackgroundVerificationPanel({ applicationId }: { applicationId: string }) {
  const [records, setRecords] = useState<BackgroundVerification[]>([]);
  const [agencies, setAgencies] = useState<ThirdPartyVerifier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifierType, setVerifierType] = useState<'HOSPITAL' | 'THIRD_PARTY'>('HOSPITAL');
  const [verificationType, setVerificationType] = useState('BACKGROUND_CHECK');
  const [thirdPartyVerifierId, setThirdPartyVerifierId] = useState('');
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [thirdPartyAddress, setThirdPartyAddress] = useState('');
  const [mouReference, setMouReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('IN_PROGRESS');
  const [editFindings, setEditFindings] = useState('');

  const load = useCallback(async () => {
    const [recs, ag] = await Promise.all([
      api<BackgroundVerification[]>(`/api/background-verifications/application/${applicationId}`),
      api<ThirdPartyVerifier[]>('/api/background-verifications/third-parties'),
    ]);
    setRecords(recs);
    setAgencies(ag);
  }, [applicationId]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/background-verifications/application/${applicationId}`, {
        method: 'POST',
        body: {
          verificationType,
          verifierType,
          thirdPartyVerifierId: verifierType === 'THIRD_PARTY' && thirdPartyVerifierId ? thirdPartyVerifierId : undefined,
          thirdPartyName: verifierType === 'THIRD_PARTY' && !thirdPartyVerifierId ? thirdPartyName : undefined,
          thirdPartyAddress: verifierType === 'THIRD_PARTY' && !thirdPartyVerifierId ? thirdPartyAddress : undefined,
          mouReference: verifierType === 'THIRD_PARTY' ? mouReference : undefined,
          remarks,
        },
      });
      setShowForm(false);
      setRemarks('');
      setThirdPartyName('');
      setThirdPartyAddress('');
      setMouReference('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record verification');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/background-verifications/${id}`, {
        method: 'PATCH',
        body: { status: editStatus, findings: editFindings },
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  function verifierLabel(r: BackgroundVerification) {
    if (r.verifierType === 'HOSPITAL' && r.performedBy) {
      return `Hospital — ${r.performedBy.firstName} ${r.performedBy.lastName}`;
    }
    const name = r.thirdPartyVerifier?.name || r.thirdPartyName || 'Third party';
    const mou = r.thirdPartyVerifier?.mouReference || r.mouReference;
    return mou ? `${name} (MOU: ${mou})` : name;
  }

  return (
    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4>Background Verification</h4>
        <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : 'Record Verification'}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        Track who performed background checks — hospital staff or registered third-party agency (with MOU details).
      </p>
      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 8 }}>
          <div className="form-group">
            <label>Verification type</label>
            <select className="form-input" value={verificationType} onChange={(e) => setVerificationType(e.target.value)}>
              {VERIFICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Performed by</label>
            <select className="form-input" value={verifierType} onChange={(e) => setVerifierType(e.target.value as 'HOSPITAL' | 'THIRD_PARTY')}>
              <option value="HOSPITAL">Hospital (in-house / credentialing staff)</option>
              <option value="THIRD_PARTY">Third-party agency</option>
            </select>
          </div>
          {verifierType === 'THIRD_PARTY' && (
            <>
              <div className="form-group">
                <label>Registered agency (if on MOU list)</label>
                <select className="form-input" value={thirdPartyVerifierId} onChange={(e) => setThirdPartyVerifierId(e.target.value)}>
                  <option value="">— Enter manually below —</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}{a.mouReference ? ` (${a.mouReference})` : ''}</option>
                  ))}
                </select>
              </div>
              {!thirdPartyVerifierId && (
                <>
                  <div className="form-group">
                    <label>Agency name</label>
                    <input className="form-input" value={thirdPartyName} onChange={(e) => setThirdPartyName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Agency address</label>
                    <textarea className="form-input" rows={2} value={thirdPartyAddress} onChange={(e) => setThirdPartyAddress(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>MOU reference</label>
                    <input className="form-input" value={mouReference} onChange={(e) => setMouReference(e.target.value)} placeholder="e.g. MOU/HR/BGV/2024-018" />
                  </div>
                </>
              )}
            </>
          )}
          <div className="form-group">
            <label>Remarks</label>
            <input className="form-input" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>Save Record</button>
        </form>
      )}

      {records.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No background verification recorded yet.</p>
      ) : (
        records.map((r) => (
          <div key={r.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <strong>{r.verificationType.replace(/_/g, ' ')}</strong>
                <div style={{ color: 'var(--color-text-muted)' }}>{verifierLabel(r)}</div>
                {r.thirdPartyAddress && <div style={{ fontSize: '0.75rem' }}>{r.thirdPartyAddress}</div>}
                {r.findings && <div style={{ marginTop: '0.25rem' }}>Findings: {r.findings}</div>}
              </div>
              <span className={`badge ${r.status === 'CLEAR' ? 'badge-success' : r.status === 'ADVERSE' ? 'badge-danger' : 'badge-warning'}`}>
                {r.status.replace(/_/g, ' ')}
              </span>
            </div>
            {editId === r.id ? (
              <div style={{ marginTop: '0.75rem' }}>
                <select className="form-input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={{ marginBottom: '0.5rem' }}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <textarea className="form-input" rows={2} placeholder="Findings / outcome" value={editFindings} onChange={(e) => setEditFindings(e.target.value)} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-primary" style={{ padding: '0.25rem 0.75rem' }} onClick={() => handleUpdate(r.id)} disabled={saving}>Save</button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem' }} onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', marginTop: '0.5rem' }} onClick={() => { setEditId(r.id); setEditStatus(r.status); setEditFindings(r.findings || ''); }}>
                Update outcome
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
