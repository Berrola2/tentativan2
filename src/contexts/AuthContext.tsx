// ==============================================================================
// CONTEXTO DE AUTENTICAÇÃO OFICIAL — VISTORIA YZZY (ETAPA 02)
// ==============================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { 
  AuthSession, 
  AuthUser, 
  UserRole, 
  LoginCredentials, 
  AuthActionResult 
} from '../types/auth';
import { getSupabaseClient } from '../services/supabaseClient';
import { 
  loginWithYzzy, 
  logoutUser, 
  fetchCurrentUserData,
  changeUserPassword 
} from '../services/auth';

interface AuthContextType {
  session: AuthSession | null;
  user: AuthUser | null;
  role: UserRole | null;
  companyId: string | null;
  companyName: string | null;
  companySlug: string | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isCompanyManager: boolean;
  isInspector: boolean;
  isViewer: boolean;
  mustChangePassword: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthActionResult<AuthSession>>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<AuthActionResult>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = getSupabaseClient();

  const loadUserData = useCallback(async (
    userId: string, 
    accessToken: string, 
    refreshToken: string, 
    expiresAt?: number
  ) => {
    try {
      const userData = await fetchCurrentUserData(userId);
      if (!userData) {
        setSession(null);
        await client.auth.signOut();
        return;
      }

      const activeSession: AuthSession = {
        accessToken,
        refreshToken,
        expiresAt,
        user: userData,
        company: userData.companyId ? {
          id: userData.companyId,
          name: userData.companyName || '',
          slug: userData.companySlug || '',
          active: true,
        } : null,
        loggedAt: new Date().toISOString(),
      };

      setSession(activeSession);
    } catch (err) {
      console.error('Erro ao carregar dados do usuário:', err);
      setSession(null);
    }
  }, [client]);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await client.auth.getSession();
        if (initialSession && initialSession.user && isMounted) {
          await loadUserData(
            initialSession.user.id,
            initialSession.access_token,
            initialSession.refresh_token,
            initialSession.expires_at
          );
        }
      } catch (err) {
        console.warn('Verificação de sessão inicial concluída:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, currentAuthSession) => {
      if (!isMounted) return;

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && currentAuthSession?.user) {
        await loadUserData(
          currentAuthSession.user.id,
          currentAuthSession.access_token,
          currentAuthSession.refresh_token,
          currentAuthSession.expires_at
        );
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [client, loadUserData]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthActionResult<AuthSession>> => {
    setIsLoading(true);
    try {
      const res = await loginWithYzzy(credentials);
      if (res.success && res.data) {
        setSession(res.data);
        return { success: true, data: res.data };
      }
      return { 
        success: false, 
        error: res.error || 'Login ou senha inválidos.',
        retryAfterSeconds: res.retryAfterSeconds,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutUser();
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const changePassword = useCallback(async (newPassword: string): Promise<AuthActionResult> => {
    const res = await changeUserPassword(newPassword);
    if (res.success && session?.user) {
      setSession((prev) => prev ? {
        ...prev,
        user: { ...prev.user, mustChangePassword: false },
      } : null);
    }
    return res;
  }, [session]);

  const refreshUser = useCallback(async (): Promise<void> => {
    if (session?.user.id && session.accessToken && session.refreshToken) {
      await loadUserData(
        session.user.id,
        session.accessToken,
        session.refreshToken,
        session.expiresAt
      );
    }
  }, [session, loadUserData]);

  const value = useMemo<AuthContextType>(() => {
    const user = session?.user || null;
    const role = user?.role || null;
    const mustChangePassword = !!user?.mustChangePassword;

    return {
      session,
      user,
      role,
      companyId: user?.companyId || null,
      companyName: user?.companyName || null,
      companySlug: user?.companySlug || null,
      isAuthenticated: !!session && !!user,
      isSuperAdmin: role === 'ROLE_SUPER_ADMIN',
      isCompanyManager: role === 'ROLE_MANAGER',
      isInspector: role === 'ROLE_INSPECTOR',
      isViewer: role === 'ROLE_VIEWER' || role === 'ROLE_ADMIN_VIEWER',
      mustChangePassword,
      isLoading,
      login,
      logout,
      changePassword,
      refreshUser,
    };
  }, [session, isLoading, login, logout, changePassword, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
