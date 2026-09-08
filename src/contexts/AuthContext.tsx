import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { 
  AuthSession, 
  AuthUser, 
  Company, 
  UserRole, 
  LoginCredentials, 
  AuthActionResult 
} from '../types/auth';
import { getSupabaseClient } from '../services/supabaseClient';
import { 
  loginEmployee, 
  logoutUser, 
  fetchProfileAndCompany 
} from '../services/authService';

interface AuthContextType {
  session: AuthSession | null;
  user: AuthUser | null;
  company: Company | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isManager: boolean;
  isInspector: boolean;
  isAdminViewer: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthActionResult<AuthSession>>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = getSupabaseClient();

  // Carrega os dados de perfil e empresa para o usuário autenticado
  const loadUserData = useCallback(async (userId: string, accessToken?: string, refreshToken?: string, expiresAt?: number) => {
    try {
      const data = await fetchProfileAndCompany(userId);
      if (!data) {
        setSession(null);
        await client.auth.signOut();
        return;
      }

      // Se empresa ou usuário estiverem desativados, encerra a sessão
      if (!data.company.active || !data.user.active) {
        console.warn('Acesso revogado: empresa ou usuário desativado.');
        setSession(null);
        await client.auth.signOut();
        return;
      }

      const activeSession: AuthSession = {
        user: data.user,
        company: data.company,
        accessToken,
        refreshToken,
        expiresAt,
        loggedAt: new Date().toISOString(),
      };

      setSession(activeSession);
    } catch (err) {
      console.error('Erro ao carregar dados do usuário autenticado:', err);
      setSession(null);
    }
  }, [client]);

  // Inicialização e escuta das mudanças de estado da sessão do Supabase
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
        console.error('Erro ao verificar sessão inicial:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    // Listener para eventos de autenticação do Supabase
    const { data: { subscription } } = client.auth.onAuthStateChange(async (event, currentAuthSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (currentAuthSession?.user) {
          await loadUserData(
            currentAuthSession.user.id,
            currentAuthSession.access_token,
            currentAuthSession.refresh_token,
            currentAuthSession.expires_at
          );
        }
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
      const res = await loginEmployee(
        credentials.companySlug,
        credentials.username,
        credentials.password
      );

      if (res.success && res.data) {
        setSession(res.data);
        return { success: true, data: res.data };
      }

      return { success: false, error: res.error || 'Credenciais inválidas.' };
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

  // Função para recarregar o perfil
  const refreshProfile = useCallback(async (): Promise<void> => {
    if (session?.user.id) {
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
    const company = session?.company || null;
    const role = user?.role || null;

    return {
      session,
      user,
      company,
      role,
      isAuthenticated: !!session && !!user,
      isManager: role === 'ROLE_MANAGER',
      isInspector: role === 'ROLE_INSPECTOR',
      isAdminViewer: role === 'ROLE_ADMIN_VIEWER',
      isLoading,
      login,
      logout,
      refreshProfile,
    };
  }, [session, isLoading, login, logout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
