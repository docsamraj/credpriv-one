'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, uploadFile } from '@/lib/api';
import { Upload, Sparkles, Save, Plus, Trash2 } from 'lucide-react';

interface ParsedPrivilegeItem {
  name: string;
  code?: string;
  description?: string;
  defaultLevel: 'FULL' | 'UNDER_SUPERVISION' | 'NONE';
}

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
  subtypes: StaffSubtype[];
}

interface JobDescriptionItemRow {
  id: string;
  name: string;
  code?: string;
  description?: string;
  defaultLevel: string;
}

interface JobDescriptionRow {
  id: string;
  title: string;
  clinicalUnit: string;
  subtype: { name: string; id?: string };
  category: { name: string };
  items: JobDescriptionItemRow[];
  sourceFileName?: string;
  aiParsedAt?: string;
}

const LEVEL_LABELS: Record<string, string> = {
  FULL: 'Full',
  UNDER_SUPERVISION: 'Under Supervision',
  NONE: 'None',
};

interface ParseResponse {
  title: string;
  clinicalUnit?: string;
  items: ParsedPrivilegeItem[];
  extractedTextPreview: string;
  parsedBy: 'cloudflare' | 'heuristic';
  sourceFileName: string;
  sourceFilePath: string;
  sourceMimeType: string;
  staffSubtypeId: string;
  staffCategoryId: string;
  suggestedCategoryCode?: string;
  suggestedSubtypeCode?: string;
  suggestedClinicalUnit?: string;
  suggestionConfidence?: 'high' | 'medium' | 'low';
  suggestionSource?: 'cloudflare' | 'heuristic';
  suggestionReason?: string;
  appliedSuggestion?: boolean;
}

const LEVELS = [
  { value: 'FULL', label: 'Full' },
  { value: 'UNDER_SUPERVISION', label: 'Under Supervision' },
  { value: 'NONE', label: 'None' },
];

export default function JobDescriptionsPanel() {
  const [categories, setCategories] = useState<StaffCategory[]>([]);
  const [existing, setExisting] = useState<JobDescriptionRow[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [subtypeId, setSubtypeId] = useState('');
  const [clinicalUnit, setClinicalUnit] = useState('');
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<ParsedPrivilegeItem[]>([]);
  const [parseMeta, setParseMeta] = useState<ParseResponse | null>(null);
  const [preview, setPreview] = useState('');
  const [parsedBy, setParsedBy] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [viewJd, setViewJd] = useState<JobDescriptionRow | null>(null);
  const [browseSubtypeId, setBrowseSubtypeId] = useState('');
  const [browseUnit, setBrowseUnit] = useState('');
  const [browseCategoryId, setBrowseCategoryId] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadingCatalog(true);
    setLoadError(null);
    try {
      const [cats, jds] = await Promise.all([
        api<StaffCategory[]>('/api/catalog/categories'),
        api<JobDescriptionRow[]>('/api/job-descriptions'),
      ]);
      setCategories(cats);
      setExisting(jds);
      if (cats.length === 0) {
        setLoadError('No staff categories found. Redeploy the backend or run: npx prisma migrate deploy && npx tsx prisma/seed.ts');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load catalog';
      setLoadError(msg);
      setCategories([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const subtypes = categories.find((c) => c.id === categoryId)?.subtypes ?? [];
  const browseSubtypes = categories.find((c) => c.id === browseCategoryId)?.subtypes ?? [];

  async function openJobDescription(jd: JobDescriptionRow) {
    try {
      const full = await api<JobDescriptionRow>(`/api/job-descriptions/${jd.id}`);
      setViewJd(full);
    } catch {
      setViewJd(jd);
    }
  }

  async function browsePrivileges() {
    if (!browseSubtypeId) {
      showMsg('error', 'Select a role to browse');
      return;
    }
    setLoading(true);
    try {
      const qs = browseUnit ? `?clinicalUnit=${encodeURIComponent(browseUnit)}` : '';
      const jd = await api<JobDescriptionRow>(`/api/catalog/job-descriptions/${browseSubtypeId}${qs}`);
      setViewJd(jd);
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'No job description for this role/unit');
    } finally {
      setLoading(false);
    }
  }

  function PrivilegeMatrixTable({ items }: { items: JobDescriptionItemRow[] }) {
    if (items.length === 0) {
      return <p style={{ color: 'var(--color-text-muted)' }}>No privilege items defined.</p>;
    }
    return (
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Privilege</th>
            <th>Code</th>
            <th>Default Level</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id || i}>
              <td>{i + 1}</td>
              <td>
                <strong>{item.name}</strong>
                {item.description && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.description}</div>
                )}
              </td>
              <td>{item.code || '—'}</td>
              <td>
                <span className="badge badge-info">{LEVEL_LABELS[item.defaultLevel] || item.defaultLevel}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setLoading(true);
    try {
      const fields: Record<string, string> = {};
      if (subtypeId) fields.staffSubtypeId = subtypeId;
      if (clinicalUnit) fields.clinicalUnit = clinicalUnit;
      if (title) fields.title = title;

      const result = await uploadFile<ParseResponse>('/api/job-descriptions/parse', file, fields);
      setParseMeta(result);
      setItems(result.items);
      setTitle(result.title);
      if (result.clinicalUnit) setClinicalUnit(result.clinicalUnit);

      // Auto-fill category / role from parse (selected or AI-detected)
      setCategoryId(result.staffCategoryId);
      setSubtypeId(result.staffSubtypeId);

      setPreview(result.extractedTextPreview);
      setParsedBy(result.parsedBy);

      const catName = categories.find((c) => c.id === result.staffCategoryId)?.name;
      const roleName = categories
        .flatMap((c) => c.subtypes.map((s) => ({ ...s, catId: c.id })))
        .find((s) => s.id === result.staffSubtypeId)?.name;

      if (result.appliedSuggestion) {
        showMsg(
          'success',
          `Detected ${catName || 'category'} → ${roleName || 'role'}${result.clinicalUnit ? ` (${result.clinicalUnit})` : ''} and parsed ${result.items.length} privileges`
        );
      } else {
        showMsg('success', `Parsed ${result.items.length} privilege items (${result.parsedBy})`);
      }
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Parse failed');
    } finally {
      setLoading(false);
    }
  }

  function updateItem(index: number, field: keyof ParsedPrivilegeItem, value: string) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { name: '', defaultLevel: 'NONE' }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handlePublish() {
    const catId = categoryId || parseMeta?.staffCategoryId;
    const subId = subtypeId || parseMeta?.staffSubtypeId;
    if (!parseMeta && !subId) {
      showMsg('error', 'Upload and parse a job description first');
      return;
    }
    if (!catId || !subId || !title) {
      showMsg('error', 'Category, role, and title are required');
      return;
    }

    setLoading(true);
    try {
      await api('/api/job-descriptions/publish', {
        method: 'POST',
        body: {
          staffCategoryId: catId,
          staffSubtypeId: subId,
          clinicalUnit,
          title,
          items,
          sourceFileName: parseMeta?.sourceFileName,
          sourceFilePath: parseMeta?.sourceFilePath,
          sourceMimeType: parseMeta?.sourceMimeType,
          extractedTextPreview: parseMeta?.extractedTextPreview,
        },
      });
      showMsg('success', 'Job description published — applicants will see this privilege matrix');
      setItems([]);
      setParseMeta(null);
      setPreview('');
      setParsedBy('');
      setTitle('');
      load();
    } catch (err) {
      showMsg('error', err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {message && (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            background: message.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
            color: 'white',
            fontSize: '0.875rem',
          }}
        >
          {message.text}
        </div>
      )}

      {loadError && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 8, background: '#fef3c7', color: '#92400e', fontSize: '0.875rem' }}>
          {loadError}
          <button type="button" className="btn btn-secondary" style={{ marginLeft: '1rem', padding: '0.25rem 0.75rem' }} onClick={() => load()}>
            Retry
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Browse Privileges by Job Description</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          Look up the privilege matrix for any role and clinical unit.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label>Category</label>
            <select className="form-input" value={browseCategoryId} onChange={(e) => { setBrowseCategoryId(e.target.value); setBrowseSubtypeId(''); }}>
              <option value="">Select...</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Role</label>
            <select className="form-input" value={browseSubtypeId} onChange={(e) => setBrowseSubtypeId(e.target.value)} disabled={!browseCategoryId}>
              <option value="">Select...</option>
              {browseSubtypes.map((s) => (
                <option key={s.id} value={s.id}>{s.parentGroup ? `${s.parentGroup} — ` : ''}{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Clinical Unit</label>
            <input className="form-input" placeholder="e.g. CTVS OT (optional)" value={browseUnit} onChange={(e) => setBrowseUnit(e.target.value)} />
          </div>
        </div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={browsePrivileges} disabled={loading || !browseSubtypeId}>
          View Privilege Matrix
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Upload Job Description</h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          Upload a Word, PDF, or Excel job description. The system detects the staff category and role from the text
          (or uses your selection), then extracts privilege line items (Full / Under Supervision / None).
          Set <strong>Clinical Unit</strong> for unit-specific roles (e.g. CTVS OT vs Surgery OT), or leave blank to auto-detect.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label>Category <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optional — auto-detect)</span></label>
            <select className="form-input" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubtypeId(''); }} disabled={loadingCatalog || categories.length === 0}>
              <option value="">{loadingCatalog ? 'Loading...' : 'Auto-detect from JD'}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Role <span style={{ color: 'var(--color-text-muted)', fontWeight: 'normal' }}>(optional)</span></label>
            <select className="form-input" value={subtypeId} onChange={(e) => setSubtypeId(e.target.value)} disabled={!categoryId}>
              <option value="">Auto-detect from JD</option>
              {subtypes.map((s) => (
                <option key={s.id} value={s.id}>{s.parentGroup ? `${s.parentGroup} — ` : ''}{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Clinical Unit (optional)</label>
            <input className="form-input" placeholder="e.g. CTVS OT, Surgery OT, CSSD" value={clinicalUnit} onChange={(e) => setClinicalUnit(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Title (optional override)</label>
            <input className="form-input" placeholder="Auto-generated from role" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>

        <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.txt,.csv" style={{ display: 'none' }} onChange={handleFile} />

        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: '1rem' }}
          disabled={loading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} /> Upload &amp; Parse with AI
        </button>

        {parseMeta?.appliedSuggestion && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--color-bg)', borderRadius: 8, fontSize: '0.875rem', border: '1px solid var(--color-border)' }}>
            <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            <strong>Auto-detected:</strong>{' '}
            {categories.find((c) => c.id === parseMeta.staffCategoryId)?.name || parseMeta.suggestedCategoryCode}
            {' → '}
            {categories.find((c) => c.id === parseMeta.staffCategoryId)?.subtypes.find((s) => s.id === parseMeta.staffSubtypeId)?.name || parseMeta.suggestedSubtypeCode}
            {parseMeta.clinicalUnit ? ` · ${parseMeta.clinicalUnit}` : ''}
            {parseMeta.suggestionReason ? ` — ${parseMeta.suggestionReason}` : ''}
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.35rem' }}>
              Confidence: {parseMeta.suggestionConfidence || 'medium'}
              {parseMeta.suggestionSource ? ` · via ${parseMeta.suggestionSource}` : ''}
              {' · '}Change the dropdowns above before publishing if this is wrong.
            </div>
          </div>
        )}

        {parsedBy && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> Privileges parsed by: {parsedBy === 'cloudflare' ? 'Cloudflare AI' : 'built-in rules (set CLOUDFLARE_API_TOKEN for smarter parsing)'}
          </p>
        )}
      </div>

      {items.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Privilege Matrix — Review &amp; Edit</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Privilege</th>
                <th>Code</th>
                <th>Default Level</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td>
                    <input className="form-input" value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)} />
                  </td>
                  <td>
                    <input className="form-input" value={item.code || ''} onChange={(e) => updateItem(i, 'code', e.target.value)} placeholder="CODE" />
                  </td>
                  <td>
                    <select className="form-input" value={item.defaultLevel} onChange={(e) => updateItem(i, 'defaultLevel', e.target.value)}>
                      {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem' }} onClick={() => removeItem(i)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={addItem}><Plus size={14} /> Add Row</button>
            <button type="button" className="btn btn-primary" onClick={handlePublish} disabled={loading}>
              <Save size={14} /> Publish to Privileging Form
            </button>
          </div>
          {preview && (
            <details style={{ marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.875rem' }}>Extracted text preview</summary>
              <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', marginTop: '0.5rem', padding: '0.75rem', background: 'var(--color-bg)', borderRadius: 8 }}>{preview}</pre>
            </details>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Published Job Descriptions</h3>
        {existing.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No job descriptions published yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Title</th><th>Role</th><th>Unit</th><th>Items</th><th>Source</th><th></th></tr>
            </thead>
            <tbody>
              {existing.map((jd) => (
                <tr key={jd.id}>
                  <td>{jd.title}</td>
                  <td>{jd.subtype.name}</td>
                  <td>{jd.clinicalUnit || '—'}</td>
                  <td>{jd.items.length}</td>
                  <td>{jd.sourceFileName || 'Seed'}</td>
                  <td>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} onClick={() => openJobDescription(jd)}>
                      View Privileges
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {viewJd && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setViewJd(null)}
        >
          <div className="card" style={{ width: '90%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', margin: '1rem' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.25rem' }}>{viewJd.title}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              {viewJd.category.name} · {viewJd.subtype.name}
              {viewJd.clinicalUnit ? ` · ${viewJd.clinicalUnit}` : ''}
            </p>
            <PrivilegeMatrixTable items={viewJd.items} />
            <button type="button" className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => setViewJd(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
