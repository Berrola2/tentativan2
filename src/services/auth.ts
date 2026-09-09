// ==============================================================================
// SERVIÇO DE AUTENTICAÇÃO E GESTÃO RBAC — VISTORIA YZZY (ETAPA 02)
// ==============================================================================

import { getSupabaseClient } from './supabaseClient';
import type { 
  LoginCredentials, 
  AuthSession, 
  AuthUser, 
  Company, 
  UserProfile,
  CreateCompanyPayload,
  CreateEmployeePayload,
  AuthActionResult,
  UserRole
} from '../types/auth';

/**
 * Realiza o login utilizando o Login YZZY (nome.sobrenome@empresa.yzzy) + senha
 */
export async function loginWithYzzy(
  credentials: LoginCredentials
): Promise<AuthActionResult<AuthSession>> {
  const client = getSupabaseClient();
  const login = credentials.login?.trim().toLowerCase();
  const password = credentials.password;

  if (!login || !password) {
    return {
      success: false,
      error: 'Por favor, informe seu Login YZZY e senha.',
    };
  }

  try {
    const { data, error } = await client.functions.invoke('login-with-yzzy', {
      body: { login, password },
    });

    if (error) {
      const serverError = (data as { error?: string })?.error;
      return {
        success: false,
        error: serverError || error.message || 'Login ou senha inválidos.',
      };
    }

    if (!data || !data.success || !data.session) {
      return {
        success: false,
        error: data?.error || 'Login ou senha inválidos.',
      };
    }

    const { session: serverSession, user: userData } = data;

    // Estabelece a sessão oficial no cliente Supabase JS
    const { error: setSessionError } = await client.auth.setSession({
      access_token: serverSession.access_token,
      refresh_token: serverSession.refresh_token,
    });

    if (setSessionError) {
      console.error('Erro ao estabelecer sessão local no Supabase JS:', setSessionError);
      return {
        success: false,
        error: 'Falha ao inicializar a sessão segura. Tente novamente.',
      };
    }

    const authUser: AuthUser = {
      id: userData.id,
      username: userData.username,
      fullName: userData.fullName,
      displayName: userData.displayName || userData.fullName,
      role: userData.role,
      active: userData.active,
      mustChangePassword: userData.mustChangePassword,
      companyId: userData.companyId || null,
      companyName: userData.companyName || null,
      companySlug: userData.companySlug || null,
      loginAlias: userData.loginAlias || login,
    };

    const company: Company | null = userData.companyId ? {
      id: userData.companyId,
      name: userData.companyName || '',
      slug: userData.companySlug || '',
      active: true,
    } : null;

    const authSession: AuthSession = {
      accessToken: serverSession.access_token,
      refreshToken: serverSession.refresh_token,
      expiresIn: serverSession.expires_in,
      expiresAt: serverSession.expires_at,
      tokenType: serverSession.token_type,
      user: authUser,
      company,
      loggedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: authSession,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao conectar ao servidor de autenticação.';
    console.error('Exceção no loginWithYzzy:', message);
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    };
  }
}

/**
 * Encerra a sessão oficial
 */
export async function logoutUser(): Promise<void> {
  const client = getSupabaseClient();
  try {
    await client.auth.signOut();
  } catch (err) {
    console.warn('Aviso durante signOut:', err);
  }
}

/**
 * Altera a senha do usuário autenticado no primeiro acesso
 */
export async function changeUserPassword(newPassword: string): Promise<AuthActionResult> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.functions.invoke('change-password', {
      body: { newPassword },
    });

    if (error || !data?.success) {
      return {
        success: false,
        error: data?.error || error?.message || 'Falha ao alterar senha.',
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return { success: false, error: message };
  }
}

/**
 * Busca dados atualizados do perfil logado
 */
export async function fetchCurrentUserData(userId: string): Promise<AuthUser | null> {
  const client = getSupabaseClient();

  try {
    const { data: profileData, error: profileErr } = await client
      .from('profiles')
      .select('id, username, full_name, display_name, first_name, last_name, role, active, must_change_password, company_id')
      .eq('id', userId)
      .single();

    if (profileErr || !profileData || !profileData.active) {
      return null;
    }

    let companyName: string | null = null;
    let companySlug: string | null = null;

    if (profileData.company_id) {
      const { data: companyData, error: companyErr } = await client
        .from('companies')
        .select('id, name, slug, active')
        .eq('id', profileData.company_id)
        .single();

      if (companyErr || !companyData || !companyData.active) {
        return null;
      }

      companyName = companyData.name;
      companySlug = companyData.slug;
    }

    return {
      id: profileData.id,
      username: profileData.username,
      fullName: profileData.full_name,
      displayName: profileData.display_name || profileData.full_name,
      role: profileData.role,
      active: profileData.active,
      mustChangePassword: profileData.must_change_password,
      companyId: profileData.company_id,
      companyName,
      companySlug,
    };
  } catch (err) {
    console.error('Erro ao buscar dados do usuário atual:', err);
    return null;
  }
}

/**
 * SUPER_ADMIN: Criação de nova empresa e primeiro gerente
 */
export async function adminCreateCompany(payload: CreateCompanyPayload): Promise<AuthActionResult<{ company: Company; manager?: { loginAlias: string; tempPassword: string; fullName: string } }>> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.functions.invoke('admin-manage-user', {
      body: { action: 'create_company', ...payload },
    });

    if (error || !data?.success) {
      return { success: false, error: data?.error || error?.message || 'Falha ao cadastrar empresa.' };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao cadastrar empresa';
    return { success: false, error: message };
  }
}

/**
 * COMPANY_MANAGER / SUPER_ADMIN: Cadastro de funcionário com Login YZZY e senha provisória
 */
export async function adminCreateEmployee(payload: CreateEmployeePayload): Promise<AuthActionResult<{ loginAlias: string; tempPassword: string; user: { id: string; fullName: string; role: UserRole } }>> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.functions.invoke('admin-manage-user', {
      body: { action: 'create_employee', ...payload },
    });

    if (error || !data?.success) {
      return { success: false, error: data?.error || error?.message || 'Falha ao cadastrar funcionário.' };
    }

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao cadastrar funcionário';
    return { success: false, error: message };
  }
}

/**
 * Ativar / Desativar funcionário
 */
export async function adminToggleUserStatus(targetUserId: string, active: boolean): Promise<AuthActionResult> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.functions.invoke('admin-manage-user', {
      body: { action: 'toggle_user_status', targetUserId, active },
    });

    if (error || !data?.success) {
      return { success: false, error: data?.error || error?.message || 'Falha ao alterar status do funcionário.' };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao alterar status';
    return { success: false, error: message };
  }
}

/**
 * Alterar cargo de funcionário
 */
export async function adminChangeUserRole(targetUserId: string, newRole: UserRole): Promise<AuthActionResult> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client.functions.invoke('admin-manage-user', {
      body: { action: 'change_user_role', targetUserId, newRole },
    });

    if (error || !data?.success) {
      return { success: false, error: data?.error || error?.message || 'Falha ao alterar cargo do funcionário.' };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao alterar cargo';
    return { success: false, error: message };
  }
}

/**
 * Lista funcionários da empresa via RLS
 */
export async function fetchEmployees(): Promise<UserProfile[]> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client
      .from('profiles')
      .select('id, company_id, username, full_name, display_name, first_name, last_name, role, active, must_change_password, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((p) => ({
      id: p.id,
      companyId: p.company_id,
      username: p.username,
      firstName: p.first_name,
      lastName: p.last_name,
      displayName: p.display_name || p.full_name,
      fullName: p.full_name,
      role: p.role as UserRole,
      active: p.active,
      mustChangePassword: p.must_change_password,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  } catch (err) {
    console.error('Erro ao listar funcionários:', err);
    return [];
  }
}

/**
 * SUPER_ADMIN: Lista todas as empresas
 */
export async function fetchCompanies(): Promise<Company[]> {
  const client = getSupabaseClient();
  try {
    const { data, error } = await client
      .from('companies')
      .select('id, name, legal_name, trade_name, slug, document_number, phone, email, active, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((c) => ({
      id: c.id,
      name: c.name,
      legalName: c.legal_name,
      tradeName: c.trade_name,
      slug: c.slug,
      documentNumber: c.document_number,
      phone: c.phone,
      email: c.email,
      active: c.active,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  } catch (err) {
    console.error('Erro ao listar empresas:', err);
    return [];
  }
}
