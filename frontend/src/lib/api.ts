const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const authToken = token ?? (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Request failed');
  }

  return data.data as T;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getUser(): { roles: string[]; firstName: string; lastName: string } | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user: unknown) {
  localStorage.setItem('user', JSON.stringify(user));
}

export function hasRole(role: string): boolean {
  const user = getUser();
  return user?.roles?.includes(role) ?? false;
}

export function getDefaultRoute(roles: string[]): string {
  if (roles.includes('PROVIDER')) return '/dashboard/provider';
  if (roles.includes('CREDENTIALING_STAFF')) return '/dashboard/staff';
  if (roles.includes('COMMITTEE_MEMBER') || roles.includes('MEC_MEMBER')) return '/dashboard/committee';
  if (roles.includes('SYSTEM_ADMIN') || roles.includes('ADMINISTRATOR')) return '/dashboard/admin';
  if (roles.includes('QUALITY_ACCREDITATION')) return '/dashboard/analytics';
  return '/dashboard/provider';
}
