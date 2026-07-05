'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Sparkles } from 'lucide-react';

interface AiStatus {
  configured: boolean;
  accountIdSet: boolean;
  apiTokenSet: boolean;
  model: string;
  gatewayId: string | null;
  parserMode: string;
  hint: string;
}

export default function AiConfigPanel() {
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    api<AiStatus>('/api/admin/ai-status').then(setStatus).catch(console.error);
  }, []);

  if (!status) return <p>Loading AI configuration...</p>;

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        Cloudflare Workers AI powers smarter job description parsing. Without it, built-in heuristic rules are used.
      </p>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Sparkles size={20} />
          <h3 style={{ margin: 0 }}>Parser status</h3>
          <span className={`badge ${status.configured ? 'badge-success' : 'badge-warning'}`}>
            {status.configured ? 'Cloudflare AI active' : 'Heuristic fallback'}
          </span>
        </div>
        <p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>{status.hint}</p>
        <dl style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '0.5rem 1rem', fontSize: '0.875rem' }}>
          <dt style={{ color: 'var(--color-text-muted)' }}>CLOUDFLARE_ACCOUNT_ID</dt>
          <dd>{status.accountIdSet ? 'Set ✓' : 'Not set'}</dd>
          <dt style={{ color: 'var(--color-text-muted)' }}>CLOUDFLARE_API_TOKEN</dt>
          <dd>{status.apiTokenSet ? 'Set ✓' : 'Not set'}</dd>
          <dt style={{ color: 'var(--color-text-muted)' }}>CLOUDFLARE_AI_MODEL</dt>
          <dd><code>{status.model}</code></dd>
          <dt style={{ color: 'var(--color-text-muted)' }}>CLOUDFLARE_AI_GATEWAY_ID</dt>
          <dd>{status.gatewayId || '— (optional)'}</dd>
        </dl>
      </div>

      <div className="card">
        <h4 style={{ marginBottom: '0.75rem' }}>Railway / production setup</h4>
        <pre style={{ fontSize: '0.75rem', background: 'var(--color-bg)', padding: '1rem', borderRadius: 8, overflow: 'auto' }}>{`CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
# Optional:
CLOUDFLARE_AI_GATEWAY_ID=your-gateway-id`}</pre>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.75rem' }}>
          After setting variables, redeploy the backend. Upload a JD in Job Descriptions — parsed by should show &quot;Cloudflare AI&quot;.
        </p>
      </div>
    </div>
  );
}
