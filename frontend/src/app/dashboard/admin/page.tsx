'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Department {
  id: string;
  name: string;
  code?: string;
}

interface Specialty {
  id: string;
  name: string;
  departmentId?: string;
}

interface WorkflowStage {
  id: string;
  name: string;
  order: number;
}

export default function AdminDashboard() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [activeTab, setActiveTab] = useState('departments');

  useEffect(() => {
    Promise.all([
      api<Department[]>('/api/admin/departments'),
      api<Specialty[]>('/api/admin/specialties'),
      api<WorkflowStage[]>('/api/admin/workflow-stages'),
    ]).then(([d, s, st]) => {
      setDepartments(d);
      setSpecialties(s);
      setStages(st);
    }).catch(console.error);
  }, []);

  const tabs = [
    { id: 'departments', label: 'Departments' },
    { id: 'specialties', label: 'Specialties' },
    { id: 'workflow', label: 'Workflow Stages' },
    { id: 'documents', label: 'Required Documents' },
    { id: 'notifications', label: 'Notification Rules' },
  ];

  return (
    <div>
      <div className="section-header">
        <h2>Admin Configuration</h2>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'departments' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Departments</h3>
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Code</th></tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr key={d.id}><td>{d.name}</td><td>{d.code ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'specialties' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Specialties</h3>
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Department</th></tr>
            </thead>
            <tbody>
              {specialties.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{departments.find((d) => d.id === s.departmentId)?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'workflow' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Workflow Stages</h3>
          <table className="table">
            <thead>
              <tr><th>Order</th><th>Stage</th></tr>
            </thead>
            <tbody>
              {stages.map((s) => (
                <tr key={s.id}><td>{s.order}</td><td>{s.name}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Required Documents</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Configure required documents per role and specialty. Managed via API at /api/admin/required-documents.
          </p>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Notification Rules</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Configure email/SMS/in-app notification rules for expiry reminders and status changes.
          </p>
        </div>
      )}
    </div>
  );
}
