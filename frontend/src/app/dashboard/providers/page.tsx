'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Provider {
  id: string;
  npi?: string;
  user: { firstName: string; lastName: string; email: string };
  profile?: {
    department?: { name: string };
    specialty?: { name: string };
  };
  applications: Array<{ status: string }>;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api<{ items: Provider[] }>(`/api/providers?search=${encodeURIComponent(search)}`)
      .then((res) => setProviders(res.items))
      .catch(console.error);
  }, [search]);

  return (
    <div>
      <div className="section-header">
        <h2>Providers</h2>
        <input
          className="form-input"
          style={{ width: 300 }}
          placeholder="Search providers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>NPI</th>
              <th>Department</th>
              <th>Specialty</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id}>
                <td>Dr. {p.user.firstName} {p.user.lastName}</td>
                <td>{p.user.email}</td>
                <td>{p.npi ?? '—'}</td>
                <td>{p.profile?.department?.name ?? '—'}</td>
                <td>{p.profile?.specialty?.name ?? '—'}</td>
                <td>
                  <span className="badge badge-info">
                    {p.applications[0]?.status ?? 'No application'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
