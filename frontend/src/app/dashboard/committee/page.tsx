'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Meeting {
  id: string;
  title: string;
  scheduledAt: string;
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
  const [selectedReview, setSelectedReview] = useState<string | null>(null);

  useEffect(() => {
    api<Meeting[]>('/api/committees/meetings')
      .then(setMeetings)
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
            {meetings.reduce((sum, m) => sum + m.reviews.filter((r) => r.status === 'PENDING').length, 0)}
          </div>
        </div>
      </div>

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
                </p>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
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
    </div>
  );
}

function ReviewPacketModal({ reviewId, onClose }: { reviewId: string; onClose: () => void }) {
  const [packet, setPacket] = useState<Record<string, unknown> | null>(null);
  const [aiSummary, setAiSummary] = useState<{ summary: string; flags: Array<{ severity: string; message: string }> } | null>(null);
  const [decision, setDecision] = useState('');
  const [rationale, setRationale] = useState('');

  useEffect(() => {
    api<Record<string, unknown>>(`/api/committees/reviews/${reviewId}`).then(setPacket).catch(console.error);
  }, [reviewId]);

  useEffect(() => {
    if (packet) {
      const providerId = (packet as { application?: { provider?: { id?: string } } }).application?.provider?.id;
      if (providerId) {
        api<{ summary: string; flags: Array<{ severity: string; message: string }> }>(
          `/api/committees/ai-summary/${providerId}`
        ).then(setAiSummary).catch(console.error);
      }
    }
  }, [packet]);

  async function submitDecision() {
    if (!decision) return;
    try {
      await api(`/api/committees/reviews/${reviewId}/decisions`, {
        method: 'POST',
        body: { decisionType: decision, rationale },
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="card" style={{ width: '90%', maxWidth: 800, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <h3>Committee Review Packet</h3>
          <button onClick={onClose} className="btn btn-secondary">Close</button>
        </div>

        {aiSummary && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: 8 }}>
            <h4 style={{ marginBottom: '0.5rem' }}>AI Case Summary</h4>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>{aiSummary.summary}</p>
            {aiSummary.flags.length > 0 && (
              <ul className="flag-list">
                {aiSummary.flags.map((flag, i) => (
                  <li key={i} className={`flag-item flag-${flag.severity.toLowerCase()}`}>
                    {flag.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

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
          <textarea
            className="form-input"
            rows={3}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Document decision rationale..."
          />
        </div>

        <button className="btn btn-primary" onClick={submitDecision} disabled={!decision}>
          Record Decision
        </button>
      </div>
    </div>
  );
}
