// ==============================================================================
// CONTEXTO DE AUTENTICAÇÃO OFICIAL — VISTORIA YZZY
// ==============================================================================
// Gerenciamento reativo do estado da sessão oficial do Supabase Auth
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
  loginWithUsername, 
  logoutUser, 
  fetchCurrentUserData 
} from '../services/auth';

interface AuthContextType {
  session: AuthSession | null;
  user: AuthUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isManager: boolean;
  isInspector: boolean;
  isAdminViewer: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthActionResult<AuthSession>>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = getSupabaseClient();

  // Carrega os dados de perfil e empresa do usuário autenticado no Supabase
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
        company: {
          id: userData.companyId,
          name: userData.companyName,
          slug: userData.companySlug,
          active: true,
        },
        loggedAt: new Date().toISOString(),
      };

      setSession(activeSession);
    } catch (err) {
      console.error('Erro ao sincronizar perfil do usuário autenticado:', err);
      setSession(null);
    }
  }, [client]);

  // Inicialização da sessão e escuta das mudanças de autenticação do Supabase
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

    // Listener oficial do Supabase Auth
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

  // Função de Login
  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthActionResult<AuthSession>> => {
    setIsLoading(true);
    try {
      const res = await loginWithUsername(credentials);
      if (res.success && res.data) {
        setSession(res.data);
        return { success: true, data: res.data };
      }
      return { 
        success: false, 
        error: res.error || 'Usuário ou senha inválidos.',
        retryAfterSeconds: res.retryAfterSeconds,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Função de Logout
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await logoutUser();
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Função para recarregar dados do usuário
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

    return {
      session,
      user,
      role,
      isAuthenticated: !!session && !!user,
      isManager: role === 'ROLE_MANAGER',
      isInspector: role === 'ROLE_INSPECTOR',
      isAdminViewer: role === 'ROLE_ADMIN_VIEWER',
      isLoading,
      login,
      logout,
      refreshUser,
    };
  }, [session, isLoading, login, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
