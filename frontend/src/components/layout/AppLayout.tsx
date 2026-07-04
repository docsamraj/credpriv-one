'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileCheck,
  Gavel,
  Settings,
  BarChart3,
  LogOut,
  Heart,
} from 'lucide-react';
import { getUser, clearToken } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard/provider', label: 'My Dashboard', icon: <LayoutDashboard size={18} />, roles: ['PROVIDER'] },
  { href: '/dashboard/staff', label: 'Staff Workflow', icon: <FileCheck size={18} />, roles: ['CREDENTIALING_STAFF'] },
  { href: '/dashboard/committee', label: 'Committee', icon: <Gavel size={18} />, roles: ['COMMITTEE_MEMBER', 'MEC_MEMBER', 'DEPARTMENT_CHAIR'] },
  { href: '/dashboard/analytics', label: 'Analytics', icon: <BarChart3 size={18} />, roles: ['ADMINISTRATOR', 'QUALITY_ACCREDITATION', 'SYSTEM_ADMIN', 'CREDENTIALING_STAFF'] },
  { href: '/dashboard/admin', label: 'Admin Config', icon: <Settings size={18} />, roles: ['SYSTEM_ADMIN', 'CREDENTIALING_STAFF'] },
  { href: '/dashboard/providers', label: 'Providers', icon: <Users size={18} />, roles: ['CREDENTIALING_STAFF', 'COMMITTEE_MEMBER', 'MEC_MEMBER', 'ADMINISTRATOR', 'SYSTEM_ADMIN'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getUser();

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.some((r) => user?.roles?.includes(r))
  );

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1><Heart size={20} style={{ display: 'inline', marginRight: 8 }} />CredPriv One</h1>
          <span>Provider Lifecycle Platform</span>
        </div>
        <nav className="sidebar-nav">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem', opacity: 0.8 }}>
            {user?.firstName} {user?.lastName}
          </div>
          <button
            onClick={handleLogout}
            className="nav-item"
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem 0' }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>
      <div className="main-content">
        <header className="topbar">
          <div>
            <strong>CredPriv One</strong>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            {user?.roles?.join(' · ')}
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
