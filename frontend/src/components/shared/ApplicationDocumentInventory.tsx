'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { DocumentComplianceReport } from '@credpriv/shared';

interface Props {
  applicationId: string;
  compact?: boolean;
}

export default function ApplicationDocumentInventory({ applicationId, compact }: Props) {
  const [report, setReport] = useState<DocumentComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!applicationId) return;
    setLoading(true);
    api<DocumentComplianceReport>(`/api/applications/${applicationId}/document-compliance`)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (loading) return <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Loading document inventory…</p>;
  if (!report) return <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Could not load documents.</p>;

  const otherFiles = (report.allDocuments || []).filter(
    (d) => !report.items.some((item) => item.type === d.type)
  );

  return (
    <div style={{ marginTop: compact ? 0 : '1rem' }}>
      <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
        Document inventory
        <span style={{ fontWeight: 'normal', color: 'var(--color-text-muted)', marginLeft: '0.5rem' }}>
          ({report.allDocuments?.length ?? 0} file{(report.allDocuments?.length ?? 0) === 1 ? '' : 's'} on record)
        </span>
      </h4>
      {report.gateEnforced === false && (
        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
          Uploads are optional for now — use this list to follow up on missing items with the applicant.
        </p>
      )}

      <table className="table" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
        <thead>
          <tr>
            <th>Suggested document</th>
            <th>Status</th>
            <th>Files on record</th>
          </tr>
        </thead>
        <tbody>
          {report.items.map((item) => (
            <tr key={item.type}>
              <td>
                {item.name}
                {item.allowsMultiple && (
                  <span className="badge badge-info" style={{ marginLeft: '0.35rem', fontSize: '0.65rem' }}>multi</span>
                )}
              </td>
              <td>
                {item.uploaded ? (
                  <span className="badge badge-success">Uploaded</span>
                ) : (
                  <span className="badge badge-warning">Not uploaded</span>
                )}
              </td>
              <td>
                {item.uploadedFiles && item.uploadedFiles.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                    {item.uploadedFiles.map((f) => (
                      <li key={f.id}>
                        {f.name}
                        <span style={{ color: 'var(--color-text-muted)' }}> — {new Date(f.uploadedAt).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {otherFiles.length > 0 && (
        <>
          <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Additional uploads</h4>
          <table className="table" style={{ fontSize: '0.8rem' }}>
            <thead><tr><th>File</th><th>Type</th><th>Uploaded</th></tr></thead>
            <tbody>
              {otherFiles.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td>{d.type}</td>
                  <td>{new Date(d.uploadedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
