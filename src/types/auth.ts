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

export interface Profile {
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
  companyId: string;
  username: string;
  fullName: string;
  role: UserRole;
  active: boolean;
}

export interface AuthSession {
  user: AuthUser;
  company: Company;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  loggedAt: string;
}

export interface LoginCredentials {
  companySlug: string;
  username: string;
  password: string;
}

export interface LookupCompanyResult {
  success: boolean;
  company?: Company;
  error?: string;
}

export interface AuthActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
