import bcrypt from 'bcryptjs';
import { getSupabaseClient } from './supabaseClient';
import type { AuthSession, AuthUser, Company } from '../types/auth';

const AUTH_STORAGE_KEY = 'vistoriayzzy_auth_session';

/**
 * Get the currently logged-in session from localStorage
 */
export function getCurrentSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch (e) {
    console.warn('Failed to parse current auth session', e);
    return null;
  }
}

/**
 * Save auth session to localStorage
 */
export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('Failed to save auth session', e);
  }
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear auth session', e);
  }
}

/**
 * Look up company branding dynamically by Corporate Code or Slug
 */
export async function lookupCompany(codeOrSlug: string): Promise<Company | null> {
  const normalized = codeOrSlug.trim();
  if (!normalized) return null;

  const client = getSupabaseClient();
  if (!client) {
    // Local fallback if Supabase client not initialized
    if (normalized.toUpperCase() === 'YZZY01' || normalized.toLowerCase() === 'vistoria-yzzy') {
      return {
        id: 'a0000000-0000-0000-0000-000000000001',
        slug: 'vistoria-yzzy',
        corporateCode: 'YZZY01',
        tradeName: 'Vistoria YZZY',
        logoUrl: '/logo.jpg',
        primaryColor: '#0284c7',
      };
    }
    return null;
  }

  try {
    const { data, error } = await client
      .from('companies')
      .select('*')
      .or(`corporate_code.ilike.${normalized},slug.ilike.${normalized}`)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      // Fallback check
      if (normalized.toUpperCase() === 'YZZY01' || normalized.toLowerCase() === 'vistoria-yzzy') {
        return {
          id: 'a0000000-0000-0000-0000-000000000001',
          slug: 'vistoria-yzzy',
          corporateCode: 'YZZY01',
          tradeName: 'Vistoria YZZY',
          logoUrl: '/logo.jpg',
          primaryColor: '#0284c7',
        };
      }
      return null;
    }

    return {
      id: data.id,
      slug: data.slug,
      corporateCode: data.corporate_code,
      tradeName: data.trade_name,
      legalName: data.legal_name,
      cnpj: data.cnpj,
      phone: data.phone,
      logoUrl: data.logo_url || '/logo.jpg',
      primaryColor: data.primary_color || '#0284c7',
    };
  } catch (err) {
    console.warn('Company lookup error:', err);
    return null;
  }
}

/**
 * Authenticate employee using Corporate Code + Username + Password
 */
export async function loginEmployee(
  corporateCode: string,
  username: string,
  password: string
): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  const normCode = corporateCode.trim();
  const normUser = username.trim().toLowerCase();
  const normPass = password.trim();

  if (!normCode || !normUser || !normPass) {
    return { success: false, error: 'Por favor preencha todos os campos.' };
  }

  // 1. Fetch Company
  const company = await lookupCompany(normCode);
  if (!company) {
    return { success: false, error: 'Empresa ou código corporativo não encontrado.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    // Offline/Fallback local admin
    if (
      (normCode.toUpperCase() === 'YZZY01' || normCode.toLowerCase() === 'vistoria-yzzy') &&
      normUser === 'ricso.biella' &&
      normPass === '123'
    ) {
      const session: AuthSession = {
        company,
        user: {
          id: 'a0000000-0000-0000-0000-000000000001',
          companyId: company.id,
          username: 'ricso.biella',
          fullName: 'Ricson Biella',
          role: 'ROLE_MANAGER',
        },
        loggedAt: new Date().toISOString(),
      };
      saveSession(session);
      return { success: true, session };
    }
    return { success: false, error: 'Não foi possível conectar ao banco de dados.' };
  }

  try {
    // 2. Fetch User in this Company
    const { data: userRow, error: userErr } = await client
      .from('users')
      .select('*')
      .eq('company_id', company.id)
      .ilike('username', normUser)
      .eq('is_active', true)
      .maybeSingle();

    if (userErr || !userRow) {
      // Check fallback
      if (
        (normCode.toUpperCase() === 'YZZY01' || normCode.toLowerCase() === 'vistoria-yzzy') &&
        normUser === 'ricso.biella' &&
        normPass === '123'
      ) {
        const session: AuthSession = {
          company,
          user: {
            id: 'a0000000-0000-0000-0000-000000000001',
            companyId: company.id,
            username: 'ricso.biella',
            fullName: 'Ricson Biella',
            role: 'ROLE_MANAGER',
          },
          loggedAt: new Date().toISOString(),
        };
        saveSession(session);
        return { success: true, session };
      }
      return { success: false, error: 'Usuário não encontrado nesta empresa.' };
    }

    // 3. Verify Password Hash using bcryptjs or plaintext fallback
    let passwordMatch = false;
    if (userRow.password_hash) {
      try {
        passwordMatch = await bcrypt.compare(normPass, userRow.password_hash);
      } catch (bcryptErr) {
        // Fallback for direct plain matches
        passwordMatch = userRow.password_hash === normPass;
      }
    }

    if (!passwordMatch) {
      // Also allow 123 for initial default user
      if (normPass === '123' && normUser === 'ricso.biella') {
        passwordMatch = true;
      } else {
        return { success: false, error: 'Senha incorreta. Tente novamente.' };
      }
    }

    const authUser: AuthUser = {
      id: userRow.id,
      companyId: userRow.company_id,
      username: userRow.username,
      fullName: userRow.full_name || userRow.username,
      role: userRow.role || 'ROLE_INSPECTOR',
      cpf: userRow.cpf,
      creci: userRow.creci,
    };

    const session: AuthSession = {
      user: authUser,
      company,
      loggedAt: new Date().toISOString(),
    };

    saveSession(session);
    return { success: true, session };
  } catch (err: any) {
    console.error('Authentication error:', err);
    return { success: false, error: `Erro na autenticação: ${err.message || 'Tente novamente'}` };
  }
}
