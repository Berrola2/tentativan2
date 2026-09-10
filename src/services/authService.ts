// ==============================================================================
// SERVIÇO DE AUTENTICAÇÃO LEGADO — REDIRECIONADO PARA O FLUXO CANÔNICO (auth.ts)
// ==============================================================================

import { 
  loginWithYzzy, 
  logoutUser as canonicalLogout, 
  fetchEmployees, 
  adminCreateEmployee, 
  adminToggleUserStatus 
} from './auth';
import type { 
  AuthSession, 
  AuthUser, 
  UserRole, 
  AuthActionResult 
} from '../types/auth';

export function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

/**
 * Redireciona para login unificado canônico
 */
export async function loginEmployee(
  companySlug: string,
  username: string,
  password: string
): Promise<AuthActionResult<AuthSession>> {
  const cleanSlug = normalizeSlug(companySlug);
  const cleanUser = username.trim().toLowerCase();
  const loginAlias = cleanUser.includes('@') ? cleanUser : `${cleanUser}@${cleanSlug}.yzzy`;

  return loginWithYzzy({
    login: loginAlias,
    password,
  });
}

export async function logoutUser(): Promise<void> {
  return canonicalLogout();
}

export async function fetchCompanyUsers(_companyId: string): Promise<AuthUser[]> {
  const list = await fetchEmployees();
  return list.map((p) => ({
    id: p.id,
    companyId: p.companyId || null,
    companyName: '',
    companySlug: '',
    username: p.username,
    fullName: p.fullName,
    displayName: p.displayName,
    role: p.role,
    active: p.active,
    mustChangePassword: p.mustChangePassword,
  }));
}

export async function createCompanyUser(
  _companyId: string,
  user: {
    username: string;
    fullName: string;
    role: UserRole;
    password?: string;
  }
): Promise<AuthActionResult<AuthUser>> {
  const parts = user.fullName.trim().split(' ');
  const firstName = parts[0] || user.username;
  const lastName = parts.slice(1).join(' ') || 'Colaborador';

  const res = await adminCreateEmployee({
    firstName,
    lastName,
    role: user.role,
  });

  if (!res.success || !res.data) {
    return { success: false, error: res.error || 'Falha ao cadastrar colaborador.' };
  }

  return {
    success: true,
    data: {
      id: res.data.user.id,
      companyId: _companyId,
      companyName: '',
      companySlug: '',
      username: res.data.loginAlias.split('@')[0],
      fullName: res.data.user.fullName,
      displayName: res.data.user.fullName,
      role: res.data.user.role,
      active: true,
    },
  };
}

export async function toggleCompanyUserActive(
  userId: string,
  active: boolean
): Promise<AuthActionResult> {
  return adminToggleUserStatus(userId, active);
}

export async function updateCompanyUserPassword(
  _userId: string,
  _newPassword: string
): Promise<AuthActionResult> {
  return { success: false, error: 'Alteração direta de senha descontinuada. Use o fluxo de redefinição de primeiro acesso.' };
}

export async function deleteCompanyUser(userId: string): Promise<AuthActionResult> {
  return adminToggleUserStatus(userId, false);
}
