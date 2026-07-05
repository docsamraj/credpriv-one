'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Trash2, Pencil, X } from 'lucide-react';

const ROLES = [
  { value: 'CHAIR', label: 'Chair' },
  { value: 'CO_CHAIR', label: 'Co-Chair' },
  { value: 'MEMBER', label: 'Member' },
  { value: 'SECRETARY', label: 'Secretary' },
  { value: 'SPECIAL_INVITEE', label: 'Special Invitee' },
];

interface CommitteeMember {
  id: string;
  displayName?: string;
  memberName?: string;
  degrees?: string;
  designation?: string;
  role: string;
  engagementStart?: string;
  engagementEnd?: string;
  user?: { id: string; firstName: string; lastName: string; email: string };
}

interface Committee {
  id: string;
  name: string;
  type: string;
  members: CommitteeMember[];
}

interface UserOption {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

const emptyForm = {
  userId: '',
  memberName: '',
  degrees: '',
  designation: '',
  role: 'MEMBER',
  engagementStart: '',
  engagementEnd: '',
};

function formatPeriod(start?: string, end?: string) {
  if (!start && !end) return '—';
  const s = start ? new Date(start).toLocaleDateString() : '—';
  const e = end ? new Date(end).toLocaleDateString() : '—';
  return `${s} → ${e}`;
}

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

export default function CommitteesPanel() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [userQuery, setUserQuery] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selected = committees.find((c) => c.id === selectedId) ?? committees[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Committee[]>('/api/admin/committees');
      setCommittees(data);
      if (!selectedId && data[0]) setSelectedId(data[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (userQuery.length < 2) {
      setUserOptions([]);
      return;
    }
    const t = setTimeout(() => {
      api<UserOption[]>(`/api/admin/users/search?q=${encodeURIComponent(userQuery)}`)
        .then(setUserOptions)
        .catch(console.error);
    }, 300);
    return () => clearTimeout(t);
  }, [userQuery]);

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setUserQuery('');
    setShowForm(true);
  }

  function openEdit(m: CommitteeMember) {
    setEditId(m.id);
    setForm({
      userId: m.user?.id ?? '',
      memberName: m.memberName ?? (m.user ? `${m.user.firstName} ${m.user.lastName}` : ''),
      degrees: m.degrees ?? '',
      designation: m.designation ?? '',
      role: m.role,
      engagementStart: m.engagementStart ? m.engagementStart.slice(0, 10) : '',
      engagementEnd: m.engagementEnd ? m.engagementEnd.slice(0, 10) : '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!selected) return;
    if (form.role === 'SPECIAL_INVITEE' && !form.memberName.trim() && !form.userId) {
      showMsg('error', 'Special invitees need a name');
      return;
    }
    if (form.role !== 'SPECIAL_INVITEE' && !editId && !form.userId && !form.memberName.trim()) {
      showMsg('error', 'Link a user or enter a name');
      return;
    }

    try {
      const body = {
        userId: form.userId || undefined,
        memberName: form.memberName,
        degrees: form.degrees,
        designation: form.designation,
        role: form.role,
        engagementStart: form.engagementStart || undefined,
        engagementEnd: form.engagementEnd || undefined,
      };

      if (editId) {
        await api(`/api/admin/committees/${selected.id}/members/${editId}`, {
          method: 'PUT',
          body,
        });
        showMsg('success', 'Member updated');
      } else {
        await api(`/api/admin/committees/${selected.id}/members`, {
          method: 'POST',
          body,
        });
        showMsg('success', 'Member added');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function handleRemove(memberId: string) {
    if (!selected || !confirm('Remove this member from the committee?')) return;
    try {
      await api(`/api/admin/committees/${selected.id}/members/${memberId}`, { method: 'DELETE' });
      showMsg('success', 'Member removed');
      await load();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Remove failed');
    }
  }

  if (loading) return <p>Loading committees...</p>;

  return (
    <div>
      {message && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)', color: 'white', fontSize: '0.875rem' }}>
          {message.text}
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Committee Roster</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          Manage committee composition with name, degrees, designation, role (Chair / Co-Chair / Member / Secretary / Special Invitee), and period of engagement.
        </p>

        <div className="form-group" style={{ maxWidth: 400 }}>
          <label>Committee</label>
          <select className="form-input" value={selected?.id ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
            {committees.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </select>
        </div>

        {selected && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0' }}>
              <h4 style={{ margin: 0 }}>{selected.name} — Members ({selected.members.length})</h4>
              <button type="button" className="btn btn-primary" onClick={openAdd}>
                <Plus size={16} /> Add Member
              </button>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Degrees</th>
                  <th>Designation</th>
                  <th>Role</th>
                  <th>Period of Engagement</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {selected.members.length === 0 ? (
                  <tr><td colSpan={6} style={{ color: 'var(--color-text-muted)' }}>No members yet.</td></tr>
                ) : (
                  selected.members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.displayName ?? m.memberName ?? '—'}</strong>
                        {m.user?.email && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{m.user.email}</div>}
                      </td>
                      <td>{m.degrees || '—'}</td>
                      <td>{m.designation || '—'}</td>
                      <td><span className="badge badge-info">{roleLabel(m.role)}</span></td>
                      <td>{formatPeriod(m.engagementStart, m.engagementEnd)}</td>
                      <td>
                        <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem', marginRight: '0.25rem' }} onClick={() => openEdit(m)}><Pencil size={14} /></button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => handleRemove(m.id)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {showForm && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowForm(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 520, margin: '1rem', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3>{editId ? 'Edit Member' : 'Add Committee Member'}</h3>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <div className="form-group">
              <label>Role</label>
              <select className="form-input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {form.role !== 'SPECIAL_INVITEE' && !editId && (
              <div className="form-group">
                <label>Link User (search by name or email)</label>
                <input className="form-input" placeholder="Type to search..." value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
                {userOptions.length > 0 && (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, marginTop: '0.5rem', maxHeight: 120, overflow: 'auto' }}>
                    {userOptions.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', background: form.userId === u.id ? 'var(--color-bg)' : 'white', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                        onClick={() => {
                          setForm((f) => ({ ...f, userId: u.id, memberName: `${u.firstName} ${u.lastName}` }));
                          setUserQuery(`${u.firstName} ${u.lastName} (${u.email})`);
                          setUserOptions([]);
                        }}
                      >
                        {u.firstName} {u.lastName} — {u.email}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-group">
              <label>Name {form.role === 'SPECIAL_INVITEE' ? '(required for invitee)' : '(optional if user linked)'}</label>
              <input className="form-input" value={form.memberName} onChange={(e) => setForm((f) => ({ ...f, memberName: e.target.value }))} placeholder="Dr. Full Name" />
            </div>

            <div className="form-group">
              <label>Degrees</label>
              <input className="form-input" value={form.degrees} onChange={(e) => setForm((f) => ({ ...f, degrees: e.target.value }))} placeholder="e.g. MBBS, MD, DM" />
            </div>

            <div className="form-group">
              <label>Designation</label>
              <input className="form-input" value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} placeholder="e.g. HOD Cardiology" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Engagement Start</label>
                <input type="date" className="form-input" value={form.engagementStart} onChange={(e) => setForm((f) => ({ ...f, engagementStart: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Engagement End</label>
                <input type="date" className="form-input" value={form.engagementEnd} onChange={(e) => setForm((f) => ({ ...f, engagementEnd: e.target.value }))} />
              </div>
            </div>

            <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={handleSave}>
              {editId ? 'Save Changes' : 'Add to Committee'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
