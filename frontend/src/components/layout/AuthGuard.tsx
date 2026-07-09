'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getToken, getUser, setUser } from '@/lib/api';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    const cached = getUser();
    if (cached) {
      setReady(true);
      return;
    }

    api<{ id: string; email: string; firstName: string; lastName: string; roles: string[]; provider?: { id: string } }>(
      '/api/auth/me'
    )
      .then((profile) => {
        setUser({
          firstName: profile.firstName,
          lastName: profile.lastName,
          roles: profile.roles,
          providerId: profile.provider?.id,
        });
        setReady(true);
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  if (!ready) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Checking session…
      </div>
    );
  }

  return <>{children}</>;
}
