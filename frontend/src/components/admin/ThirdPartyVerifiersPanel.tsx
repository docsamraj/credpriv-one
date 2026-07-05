'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';

interface ThirdPartyVerifier {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  mouReference?: string;
  mouValidFrom?: string;
  mouValidTo?: string;
  servicesOffered?: string;
}

export default function ThirdPartyVerifiersPanel() {
  const [agencies, setAgencies] = useState<ThirdPartyVerifier[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    mouReference: '',
    mouValidFrom: '',
    mouValidTo: '',
    servicesOffered: '',
    notes: '',
  });
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<ThirdPartyVerifier[]>('/api/background-verifications/third-parties');
    setAgencies(data);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      await api('/api/background-verifications/third-parties', {
        method: 'POST',
        body: {
          ...form,
          mouValidFrom: form.mouValidFrom || undefined,
          mouValidTo: form.mouValidTo || undefined,
        },
      });
      setShowForm(false);
      setForm({
        name: '', address: '', city: '', state: '', pinCode: '',
        contactPerson: '', contactPhone: '', contactEmail: '',
        mouReference: '', mouValidFrom: '', mouValidTo: '',
        servicesOffered: '', notes: '',
      });
      setMessage('Third-party verifier registered');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Approved background verification agencies with MOU details for hospital compliance.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Register agency
        </button>
      </div>
      {message && <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>{message}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group"><label>Agency name</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-group"><label>Address</label><input className="form-input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '0.75rem' }}>
            <div className="form-group"><label>City</label><input className="form-input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div className="form-group"><label>State</label><input className="form-input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div className="form-group"><label>PIN</label><input className="form-input" value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>MOU reference</label><input className="form-input" value={form.mouReference} onChange={(e) => setForm({ ...form, mouReference: e.target.value })} placeholder="MOU/HR/BGV/2024-018" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group"><label>MOU valid from</label><input type="date" className="form-input" value={form.mouValidFrom} onChange={(e) => setForm({ ...form, mouValidFrom: e.target.value })} /></div>
            <div className="form-group"><label>MOU valid to</label><input type="date" className="form-input" value={form.mouValidTo} onChange={(e) => setForm({ ...form, mouValidTo: e.target.value })} /></div>
          </div>
          <div className="form-group"><label>Services offered</label><input className="form-input" value={form.servicesOffered} onChange={(e) => setForm({ ...form, servicesOffered: e.target.value })} /></div>
          <div className="form-group"><label>Contact person / phone / email</label>
            <input className="form-input" placeholder="Contact person" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} style={{ marginBottom: '0.5rem' }} />
            <input className="form-input" placeholder="Phone" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} style={{ marginBottom: '0.5rem' }} />
            <input className="form-input" placeholder="Email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-primary">Save agency</button>
        </form>
      )}

      <div className="card">
        <table className="table">
          <thead><tr><th>Agency</th><th>MOU</th><th>Valid until</th><th>Services</th></tr></thead>
          <tbody>
            {agencies.map((a) => (
              <tr key={a.id}>
                <td>
                  <strong>{a.name}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{[a.address, a.city, a.state].filter(Boolean).join(', ')}</div>
                </td>
                <td>{a.mouReference || '—'}</td>
                <td>{a.mouValidTo ? new Date(a.mouValidTo).toLocaleDateString() : '—'}</td>
                <td style={{ fontSize: '0.8rem' }}>{a.servicesOffered || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
