// ==============================================================================
// SERVIÇO DE AUTENTICAÇÃO OFICIAL COM SUPABASE — VISTORIA YZZY
// ==============================================================================
// Gerenciamento de sessão, login seguro via Edge Function e logout oficial
// ==============================================================================

import { getSupabaseClient } from './supabaseClient';
import type { 
  LoginCredentials, 
  AuthSession, 
  AuthUser, 
  PublicCompanyInfo, 
  AuthActionResult 
} from '../types/auth';

/**
 * Realiza o login utilizando a combinação segura de empresa (slug) + usuário + senha.
 * A requisição é processada pela Edge Function dedicada do Supabase, que valida as credenciais
 * e retorna a sessão oficial gerada pelo Supabase Auth.
 */
export async function loginWithUsername(
  credentials: LoginCredentials
): Promise<AuthActionResult<AuthSession>> {
  const client = getSupabaseClient();

  const companySlug = credentials.companySlug?.trim().toLowerCase();
  const username = credentials.username?.trim().toLowerCase();
  const password = credentials.password;

  if (!companySlug || !username || !password) {
    return {
      success: false,
      error: 'Por favor, preencha empresa, usuário e senha.',
    };
  }

  try {
    // 1. Invocar a Edge Function login-with-username
    const { data, error } = await client.functions.invoke('login-with-username', {
      body: {
        companySlug,
        username,
        password,
      },
    });

    if (error) {
      const serverError = (data as { error?: string })?.error;
      const retryAfter = (data as { retryAfterSeconds?: number })?.retryAfterSeconds;

      return {
        success: false,
        error: serverError || error.message || 'Usuário ou senha inválidos.',
        retryAfterSeconds: retryAfter,
      };
    }

    if (!data || !data.success || !data.session) {
      return {
        success: false,
        error: data?.error || 'Usuário ou senha inválidos.',
        retryAfterSeconds: data?.retryAfterSeconds,
      };
    }

    const { session: serverSession, user: userData } = data;

    // 2. Estabelecer a sessão no cliente oficial do Supabase JS
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
      role: userData.role,
      active: true,
      companyId: userData.companyId,
      companyName: userData.companyName,
      companySlug: userData.companySlug,
    };

    const authSession: AuthSession = {
      accessToken: serverSession.access_token,
      refreshToken: serverSession.refresh_token,
      expiresIn: serverSession.expires_in,
      expiresAt: serverSession.expires_at,
      tokenType: serverSession.token_type,
      user: authUser,
      company: {
        id: userData.companyId,
        name: userData.companyName,
        slug: userData.companySlug,
        active: true,
      },
      loggedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: authSession,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao conectar ao servidor de autenticação.';
    console.error('Exceção no loginWithUsername:', message);
    return {
      success: false,
      error: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    };
  }
}

/**
 * Encerra a sessão atual no Supabase Auth e limpa os tokens do cliente oficial.
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
 * Recupera as informações públicas de uma empresa através de seu slug (para verificação pré-login).
 */
export async function lookupPublicCompany(slug: string): Promise<PublicCompanyInfo | null> {
  const client = getSupabaseClient();
  const cleanSlug = slug.trim().toLowerCase();

  if (!cleanSlug) return null;

  try {
    const { data, error } = await client.rpc('get_company_login_info', { p_slug: cleanSlug });

    if (error || !data || data.length === 0) {
      return null;
    }

    const item = data[0];
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      logoUrl: item.logo_url,
      active: item.active,
    };
  } catch (err) {
    console.warn('Erro ao consultar empresa pública por slug:', err);
    return null;
  }
}

/**
 * Busca os dados de perfil e empresa do usuário logado através das políticas RLS no Supabase.
 */
export async function fetchCurrentUserData(userId: string): Promise<AuthUser | null> {
  const client = getSupabaseClient();

  try {
    const { data: profileData, error: profileErr } = await client
      .from('profiles')
      .select('id, username, full_name, role, active, company_id')
      .eq('id', userId)
      .single();

    if (profileErr || !profileData || !profileData.active) {
      return null;
    }

    const { data: companyData, error: companyErr } = await client
      .from('companies')
      .select('id, name, slug, active')
      .eq('id', profileData.company_id)
      .single();

    if (companyErr || !companyData || !companyData.active) {
      return null;
    }

    return {
      id: profileData.id,
      username: profileData.username,
      fullName: profileData.full_name,
      role: profileData.role,
      active: profileData.active,
      companyId: companyData.id,
      companyName: companyData.name,
      companySlug: companyData.slug,
    };
  } catch (err) {
    console.error('Erro ao buscar dados do usuário atual:', err);
    return null;
  }
}
