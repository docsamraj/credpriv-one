// Prefer NEXT_PUBLIC_API_URL (direct backend) — avoids broken Next.js rewrites when BACKEND_URL is unset.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.BACKEND_URL ||
  (typeof window !== 'undefined' ? '' : 'http://localhost:4000');

export interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      text.startsWith('Internal') || text.startsWith('<')
        ? 'Cannot reach API server. Check NEXT_PUBLIC_API_URL and BACKEND_URL on the frontend service.'
        : text.slice(0, 200) || `Request failed (${res.status})`
    );
  }
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

  const data = await parseResponse<{ success: boolean; data: T; error?: string }>(res);

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Request failed');
  }

  return data.data as T;
}

export async function uploadFile<T>(
  endpoint: string,
  file: File,
  fields: Record<string, string> = {}
): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await parseResponse<{ success: boolean; data: T; error?: string }>(res);

  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Upload failed');
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

export function getUser(): {
  roles: string[];
  firstName: string;
  lastName: string;
  providerId?: string;
} | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export async function downloadBlob(endpoint: string, filename: string): Promise<void> {
  const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}${endpoint}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.slice(0, 200) || `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
  if (roles.includes('DEPARTMENT_CHAIR')) return '/dashboard/department';
  if (roles.includes('CREDENTIALING_STAFF')) return '/dashboard/staff';
  if (roles.includes('COMMITTEE_MEMBER') || roles.includes('MEC_MEMBER')) return '/dashboard/committee';
  if (roles.includes('SYSTEM_ADMIN') || roles.includes('ADMINISTRATOR')) return '/dashboard/admin';
  if (roles.includes('QUALITY_ACCREDITATION')) return '/dashboard/analytics';
  return '/dashboard/provider';
}
