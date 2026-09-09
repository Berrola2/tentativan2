import { getSupabaseClient } from './supabaseClient';
import type { 
  AuthSession, 
  AuthUser, 
  Company, 
  UserRole, 
  AuthActionResult 
} from '../types/auth';

/**
 * Normaliza slug de empresa para busca padronizada
 */
export function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

/**
 * Busca dados visuais e status de uma empresa a partir do slug
 */
export async function lookupCompany(slug: string): Promise<Company | null> {
  const cleanSlug = normalizeSlug(slug);
  if (!cleanSlug) return null;

  const client = getSupabaseClient();

  try {
    // 1. Tentar via RPC lookup_company_by_slug
    const { data: rpcData, error: rpcError } = await client.rpc('lookup_company_by_slug', {
      p_slug: cleanSlug,
    });

    if (!rpcError && rpcData && typeof rpcData === 'object') {
      const resp = rpcData as { success: boolean; company?: { id: string; name: string; slug: string; logo_url?: string; active: boolean } };
      if (resp.company) {
        return {
          id: resp.company.id,
          name: resp.company.name,
          slug: resp.company.slug,
          logoUrl: resp.company.logo_url || '/logo.jpg',
          active: resp.company.active,
        };
      }
    }

    // 2. Fallback direto via SELECT na tabela companies com RLS
    const { data, error } = await client
      .from('companies')
      .select('id, name, slug, logo_url, active, created_at, updated_at')
      .ilike('slug', cleanSlug)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      logoUrl: data.logo_url || '/logo.jpg',
      active: data.active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.warn('Falha na busca da empresa:', err);
    return null;
  }
}

/**
 * Recupera o perfil completo e a empresa vinculada ao usuário logado
 */
export async function fetchProfileAndCompany(userId: string): Promise<{ user: AuthUser; company: Company } | null> {
  const client = getSupabaseClient();

  try {
    const { data: profile, error: profileErr } = await client
      .from('profiles')
      .select('id, company_id, username, full_name, role, active, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileErr || !profile) {
      console.warn('Perfil não encontrado para o usuário:', userId, profileErr);
      return null;
    }

    const { data: company, error: compErr } = await client
      .from('companies')
      .select('id, name, slug, logo_url, active, created_at, updated_at')
      .eq('id', profile.company_id)
      .maybeSingle();

    if (compErr || !company) {
      console.warn('Empresa não encontrada para o perfil:', profile.company_id, compErr);
      return null;
    }

    const authUser: AuthUser = {
      id: profile.id,
      companyId: profile.company_id,
      companyName: company.name,
      companySlug: company.slug,
      username: profile.username,
      fullName: profile.full_name,
      displayName: profile.full_name,
      role: profile.role as UserRole,
      active: profile.active,
    };

    const companyData: Company = {
      id: company.id,
      name: company.name,
      slug: company.slug,
      logoUrl: company.logo_url || '/logo.jpg',
      active: company.active,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    };

    return { user: authUser, company: companyData };
  } catch (e) {
    console.error('Exceção ao recuperar perfil e empresa:', e);
    return null;
  }
}

/**
 * Autenticação de colaborador usando Company Slug + Username + Senha
 * Arquitetura: Resolve o identificador interno via RPC seguro e autentica nativamente via Supabase Auth
 */
export async function loginEmployee(
  companySlug: string,
  username: string,
  password: string
): Promise<AuthActionResult<AuthSession>> {
  const cleanSlug = normalizeSlug(companySlug);
  const cleanUser = username.trim().toLowerCase();
  const cleanPass = password.trim();

  if (!cleanSlug || !cleanUser || !cleanPass) {
    return { success: false, error: 'Por favor, preencha todos os campos.' };
  }

  const client = getSupabaseClient();

  try {
    // 1. Obter o identificador de login de forma segura no backend Supabase
    const { data: idData, error: idErr } = await client.rpc('get_login_identifier', {
      p_company_slug: cleanSlug,
      p_username: cleanUser,
    });

    if (idErr) {
      console.warn('Erro ao consultar identificador de login:', idErr);
      return { 
        success: false, 
        error: 'Não foi possível validar as credenciais. Verifique a conexão com o Supabase.' 
      };
    }

    const idResp = idData as { success: boolean; identifier?: string; error?: string };
    if (!idResp || !idResp.success || !idResp.identifier) {
      return { 
        success: false, 
        error: idResp?.error || 'Empresa, usuário ou senha inválidos.' 
      };
    }

    // 2. Efetuar login oficial no Supabase Auth com o identificador interno
    const { data: authData, error: authErr } = await client.auth.signInWithPassword({
      email: idResp.identifier,
      password: cleanPass,
    });

    if (authErr || !authData.user) {
      return { 
        success: false, 
        error: 'Empresa, usuário ou senha inválidos.' 
      };
    }

    // 3. Recuperar Profile e Company associados e protegidos por RLS
    const account = await fetchProfileAndCompany(authData.user.id);
    if (!account) {
      await client.auth.signOut();
      return { 
        success: false, 
        error: 'Perfil de usuário não localizado no sistema.' 
      };
    }

    // 4. Validar se usuário ou empresa foram desativados
    if (!account.company.active) {
      await client.auth.signOut();
      return { 
        success: false, 
        error: 'Esta empresa está temporariamente desativada.' 
      };
    }

    if (!account.user.active) {
      await client.auth.signOut();
      return { 
        success: false, 
        error: 'Seu usuário está desativado. Contate o administrador.' 
      };
    }

    const session: AuthSession = {
      user: account.user,
      company: account.company,
      accessToken: authData.session?.access_token,
      refreshToken: authData.session?.refresh_token,
      expiresAt: authData.session?.expires_at,
      loggedAt: new Date().toISOString(),
    };

    return { success: true, data: session };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Falha na autenticação';
    return { success: false, error: `Erro na autenticação: ${message}` };
  }
}

/**
 * Encerra a sessão atual no Supabase Auth
 */
export async function logoutUser(): Promise<void> {
  const client = getSupabaseClient();
  try {
    await client.auth.signOut();
  } catch (err) {
    console.warn('Erro ao realizar logout:', err);
  }
}

/**
 * Lista todos os usuários de uma empresa (Exclusivo para ROLE_MANAGER / Membros autorizados)
 */
export async function fetchCompanyUsers(companyId: string): Promise<AuthUser[]> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('profiles')
      .select('id, company_id, username, full_name, role, active, created_at, updated_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('Erro ao buscar usuários da empresa:', error);
      return [];
    }

    return (data as Array<{
      id: string;
      company_id: string;
      username: string;
      full_name: string;
      role: string;
      active: boolean;
    }>).map((u) => ({
      id: u.id,
      companyId: u.company_id,
      companyName: '',
      companySlug: '',
      username: u.username,
      fullName: u.full_name,
      displayName: u.full_name,
      role: u.role as UserRole,
      active: u.active,
    }));
  } catch (e) {
    console.warn('Exceção ao listar usuários da empresa:', e);
    return [];
  }
}

/**
 * Cria um novo colaborador na empresa via RPC seguro no Supabase
 */
export async function createCompanyUser(
  companyId: string,
  user: {
    username: string;
    fullName: string;
    role: UserRole;
    password: string;
  }
): Promise<AuthActionResult<AuthUser>> {
  const cleanUsername = user.username.trim().toLowerCase();
  const cleanFullName = user.fullName.trim();
  const cleanPassword = user.password.trim();

  if (!cleanUsername || !cleanFullName || !cleanPassword) {
    return { success: false, error: 'Preencha Nome Completo, Usuário e Senha.' };
  }

  if (cleanPassword.length < 6) {
    return { success: false, error: 'A senha deve conter no mínimo 6 caracteres.' };
  }

  const client = getSupabaseClient();

  try {
    const { data, error } = await client.rpc('create_company_user', {
      p_company_id: companyId,
      p_username: cleanUsername,
      p_full_name: cleanFullName,
      p_role: user.role,
      p_password: cleanPassword,
    });

    if (error) {
      return { success: false, error: `Erro ao criar usuário: ${error.message}` };
    }

    const resp = data as { 
      success: boolean; 
      error?: string; 
      user?: { 
        id: string; 
        company_id: string; 
        username: string; 
        full_name: string; 
        role: string; 
        active: boolean 
      } 
    };

    if (!resp.success || !resp.user) {
      return { success: false, error: resp.error || 'Erro ao criar usuário.' };
    }

    return {
      success: true,
      data: {
        id: resp.user.id,
        companyId: resp.user.company_id,
        companyName: '',
        companySlug: '',
        username: resp.user.username,
        fullName: resp.user.full_name,
        displayName: resp.user.full_name,
        role: resp.user.role as UserRole,
        active: resp.user.active,
      },
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro inesperado';
    return { success: false, error: `Erro inesperado: ${message}` };
  }
}

/**
 * Atualiza a senha de um usuário via RPC seguro
 */
export async function updateCompanyUserPassword(
  userId: string,
  newPassword: string
): Promise<AuthActionResult> {
  if (!newPassword || newPassword.trim().length < 6) {
    return { success: false, error: 'A nova senha deve ter no mínimo 6 caracteres.' };
  }

  const client = getSupabaseClient();

  try {
    const { data, error } = await client.rpc('update_company_user_password', {
      p_target_user_id: userId,
      p_new_password: newPassword.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const resp = data as { success: boolean; error?: string; message?: string };
    if (!resp.success) {
      return { success: false, error: resp.error || 'Erro ao atualizar senha.' };
    }

    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro inesperado';
    return { success: false, error: message };
  }
}

/**
 * Ativa ou desativa um usuário da empresa
 */
export async function toggleCompanyUserActive(
  userId: string,
  active: boolean
): Promise<AuthActionResult> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client.rpc('toggle_company_user_active', {
      p_target_user_id: userId,
      p_active: active,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const resp = data as { success: boolean; error?: string };
    if (!resp.success) {
      return { success: false, error: resp.error || 'Erro ao alterar status do usuário.' };
    }

    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro inesperado';
    return { success: false, error: message };
  }
}

/**
 * Remove um usuário da empresa (Exclusivo para ROLE_MANAGER)
 */
export async function deleteCompanyUser(userId: string): Promise<AuthActionResult> {
  const client = getSupabaseClient();

  try {
    const { data, error } = await client.rpc('delete_company_user', {
      p_target_user_id: userId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const resp = data as { success: boolean; error?: string };
    if (!resp.success) {
      return { success: false, error: resp.error || 'Erro ao remover usuário.' };
    }

    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro inesperado';
    return { success: false, error: message };
  }
}
