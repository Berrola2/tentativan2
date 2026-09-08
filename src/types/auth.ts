// ==============================================================================
// TIPOS DE AUTENTICAÇÃO E RBAC — VISTORIA YZZY
// ==============================================================================

export type UserRole = 
  | 'ROLE_MANAGER' 
  | 'ROLE_INSPECTOR' 
  | 'ROLE_ADMIN_VIEWER' 
  | 'ROLE_TENANT_CLIENT' 
  | 'ROLE_LANDLORD_CLIENT';

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  id: string;
  companyId: string;
  username: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  companyId: string;
  companyName: string;
  companySlug: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
  user: AuthUser;
  company: Company;
  loggedAt: string;
}

export interface LoginCredentials {
  companySlug: string;
  username: string;
  password: string;
}

export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  company: Company | null;
  role: UserRole | null;
  companyId: string | null;
  companySlug: string | null;
  companyName: string | null;
  isAuthenticated: boolean;
  isManager: boolean;
  isInspector: boolean;
  isAdminViewer: boolean;
  isLoading: boolean;
}

export interface PublicCompanyInfo {
  name: string;
  slug: string;
  logoUrl?: string;
  active: boolean;
}

export interface AuthActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  retryAfterSeconds?: number;
}
