'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  user?: { firstName: string; lastName: string; email: string };
}

interface AuditResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AuditLogsPanel() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<AuditResponse>(`/api/admin/audit-logs?page=${page}&pageSize=50`);
      setData(result);
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="card">
      <h3 style={{ marginBottom: '1rem' }}>Audit Trail</h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Immutable log of credentialing actions for accreditation review.
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No audit entries found.</p>
      ) : (
        <>
          <table className="table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>
                    {log.user
                      ? `${log.user.firstName} ${log.user.lastName}`
                      : '—'}
                  </td>
                  <td><span className="badge badge-info">{log.action}</span></td>
                  <td>{log.entityType} · {log.entityId.slice(0, 8)}…</td>
                  <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.metadata ? JSON.stringify(log.metadata) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              {data.total} entries · page {data.page} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </button>
              <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
