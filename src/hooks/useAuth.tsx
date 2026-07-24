import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { AuthUser, AuthState, LoginCredentials, RegisterCredentials } from '@/types/auth';
import { authApi } from '@/lib/authApi';
import { cloudStorage } from '@/lib/cloudStorage';
import { adminConfig } from '@/lib/adminConfig';

// ── Cloud-backed auth ────────────────────────────────────────────────────
// Accounts, passwords, and the "who am I" session all live in Cloudflare
// D1 now (see /functions/api/auth/*) instead of this browser's
// localStorage, which is what lets the same account sign in from any
// device. The server sets an HttpOnly session cookie on login/register —
// this file never sees or stores a password or token itself, it just
// calls the API and keeps the resulting user in React state.

interface AuthContextType extends AuthState {
  login: (creds: LoginCredentials, remember?: boolean) => Promise<{ success: boolean; error?: string }>;
  register: (creds: RegisterCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAllUsers: () => AuthUser[];
  refreshUsers: () => Promise<AuthUser[]>;
  updateUser: (id: string, updates: Partial<AuthUser>) => void;
  deleteUser: (id: string) => void;
  toggleUserActive: (id: string) => void;
  updateCurrentUserProfile: (updates: Partial<AuthUser>) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  isOnline: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [allUsers, setAllUsers] = useState<AuthUser[]>([]);

  // Once we know who's signed in, pull their data blob + the shared AI
  // config into the in-memory caches those hooks/pages read from.
  const primeCloudCaches = useCallback(async () => {
    await Promise.all([cloudStorage.init(), adminConfig.init()]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await authApi.me();
      if (cancelled) return;
      if (res.ok && res.data) {
        await primeCloudCaches();
        if (!cancelled) setCurrentUser(res.data.user);
      }
      if (!cancelled) setIsLoading(false);
    })();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [primeCloudCaches]);

  const login = useCallback(async (creds: LoginCredentials, remember = false): Promise<{ success: boolean; error?: string }> => {
    const res = await authApi.login({ email: creds.email, password: creds.password, remember });
    if (!res.ok || !res.data) return { success: false, error: res.error || 'Login failed' };
    await primeCloudCaches();
    setCurrentUser(res.data.user);
    return { success: true };
  }, [primeCloudCaches]);

  const register = useCallback(async (creds: RegisterCredentials): Promise<{ success: boolean; error?: string }> => {
    const res = await authApi.register(creds);
    if (!res.ok || !res.data) return { success: false, error: res.error || 'Registration failed' };
    await primeCloudCaches();
    setCurrentUser(res.data.user);
    return { success: true };
  }, [primeCloudCaches]);

  const logout = useCallback(() => {
    authApi.logout();
    cloudStorage.resetLocal();
    setCurrentUser(null);
    setAllUsers([]);
  }, []);

  const refreshUsers = useCallback(async (): Promise<AuthUser[]> => {
    const res = await authApi.adminListUsers();
    const users = res.ok && res.data ? res.data.users : [];
    setAllUsers(users);
    return users;
  }, []);

  // Admin user-management pages call getAllUsers() synchronously (it used
  // to just read localStorage). Kick off a refresh in the background and
  // return whatever's cached from the last fetch in the meantime.
  const getAllUsers = useCallback(() => {
    refreshUsers();
    return allUsers;
  }, [refreshUsers, allUsers]);

  const updateUser = useCallback((id: string, updates: Partial<AuthUser>) => {
    authApi.adminUpdateUser(id, updates).then(res => {
      if (res.ok && res.data) {
        setAllUsers(prev => prev.map(u => u.id === id ? res.data!.user : u));
        if (currentUser?.id === id) setCurrentUser(prev => prev ? { ...prev, ...res.data!.user } : prev);
      }
    });
  }, [currentUser]);

  const deleteUser = useCallback((id: string) => {
    authApi.adminDeleteUser(id).then(res => {
      if (res.ok) setAllUsers(prev => prev.filter(u => u.id !== id));
    });
  }, []);

  const toggleUserActive = useCallback((id: string) => {
    const user = allUsers.find(u => u.id === id);
    if (!user) return;
    updateUser(id, { isActive: !user.isActive });
  }, [allUsers, updateUser]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const res = await authApi.changePassword(currentPassword, newPassword);
    if (!res.ok) return { success: false, error: res.error || 'Failed to change password' };
    return { success: true };
  }, []);

  const updateCurrentUserProfile = useCallback((updates: Partial<AuthUser>) => {
    if (!currentUser) return;
    setCurrentUser(prev => prev ? { ...prev, ...updates } : prev);
    authApi.updateProfile(updates).then(res => {
      if (res.ok && res.data) setCurrentUser(res.data.user);
    });
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAuthenticated: !!currentUser,
      isLoading,
      isOnline,
      login,
      register,
      logout,
      getAllUsers,
      refreshUsers,
      updateUser,
      deleteUser,
      toggleUserActive,
      updateCurrentUserProfile,
      changePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
