'use client';

import { useState } from 'react';
import { openDocument } from '@/lib/api';

interface Props {
  id: string;
  name: string;
}

export default function DocumentLink({ id, name }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    setLoading(true);
    try {
      await openDocument(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not open document');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={loading}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'var(--color-primary)',
        textDecoration: 'underline',
        cursor: loading ? 'wait' : 'pointer',
        fontSize: 'inherit',
        textAlign: 'left',
      }}
    >
      {loading ? 'Opening…' : name}
    </button>
  );
}
