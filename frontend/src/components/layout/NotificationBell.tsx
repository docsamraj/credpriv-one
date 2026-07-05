'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '@/lib/api';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([
        api<NotificationItem[]>('/api/notifications?unread=true'),
        api<{ count: number }>('/api/notifications/unread-count'),
      ]);
      setItems(list);
      setCount(unread.count);
    } catch {
      /* not logged in or API unavailable */
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function markRead(id: string) {
    await api(`/api/notifications/${id}/read`, { method: 'PATCH' });
    await load();
  }

  async function markAllRead() {
    await api('/api/notifications/read-all', { method: 'POST' });
    await load();
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '0.25rem',
          color: 'var(--color-text-muted)',
        }}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {count > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'var(--color-danger)',
              color: 'white',
              borderRadius: 999,
              fontSize: '0.65rem',
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '0.5rem',
            width: 320,
            maxHeight: 400,
            overflow: 'auto',
            background: 'white',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            zIndex: 1000,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
            <strong style={{ fontSize: '0.875rem' }}>Notifications</strong>
            {count > 0 && (
              <button type="button" className="btn btn-secondary" style={{ padding: '0.15rem 0.5rem', fontSize: '0.7rem' }} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No unread notifications</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  borderBottom: '1px solid var(--color-border)',
                  background: n.isRead ? 'white' : '#f0f7ff',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{n.title}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{n.message.slice(0, 120)}{n.message.length > 120 ? '…' : ''}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{new Date(n.createdAt).toLocaleString()}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
