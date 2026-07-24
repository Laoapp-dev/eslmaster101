import type { AuthUser } from '@/types/auth';

async function request<T>(url: string, options: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      ...options,
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) return { ok: false, status: res.status, data: null, error: data?.error || `Request failed (${res.status})` };
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: null, error: 'Network error — check your connection' };
  }
}

export const authApi = {
  me: () => request<{ user: AuthUser }>('/api/auth/me'),
  register: (body: { username: string; email: string; password: string; fullName: string; country: string }) =>
    request<{ user: AuthUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string; remember?: boolean }) =>
    request<{ user: AuthUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  updateProfile: (updates: Partial<AuthUser>) =>
    request<{ user: AuthUser }>('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ updates }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  adminListUsers: () => request<{ users: AuthUser[] }>('/api/admin/users'),
  adminUpdateUser: (id: string, updates: Partial<AuthUser>) =>
    request<{ user: AuthUser }>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ updates }) }),
  adminDeleteUser: (id: string) => request<{ success: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
};
