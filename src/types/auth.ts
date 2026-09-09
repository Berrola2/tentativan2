// ==============================================================================
// TIPOS DE AUTENTICAÇÃO E RBAC — VISTORIA YZZY (ETAPA 02)
// ==============================================================================

export type UserRole = 
  | 'ROLE_SUPER_ADMIN'
  | 'ROLE_MANAGER' 
  | 'ROLE_INSPECTOR' 
  | 'ROLE_VIEWER'
  | 'ROLE_ADMIN_VIEWER' 
  | 'ROLE_TENANT_CLIENT' 
  | 'ROLE_LANDLORD_CLIENT';

export interface Company {
  id: string;
  name: string;
  legalName?: string;
  tradeName?: string;
  slug: string;
  documentNumber?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  employeeCount?: number;
}

export interface UserProfile {
  id: string;
  companyId?: string | null;
  username: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  mustChangePassword?: boolean;
  loginAlias?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  mustChangePassword?: boolean;
  companyId?: string | null;
  companyName?: string | null;
  companySlug?: string | null;
  loginAlias?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
  user: AuthUser;
  company?: Company | null;
  loggedAt: string;
}

export interface LoginCredentials {
  login: string; // Login YZZY (ex: joao.silva@empresa.yzzy) ou username
  password: string;
}

export interface CreateCompanyPayload {
  name: string;
  legalName?: string;
  tradeName?: string;
  slug?: string;
  documentNumber?: string;
  phone?: string;
  email?: string;
  managerFirstName?: string;
  managerLastName?: string;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  role: UserRole;
  targetCompanyId?: string;
}

export interface ChangePasswordPayload {
  newPassword: string;
  confirmPassword: string;
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
  isSuperAdmin: boolean;
  isCompanyManager: boolean;
  isInspector: boolean;
  isViewer: boolean;
  mustChangePassword: boolean;
  isLoading: boolean;
}

export interface AuthActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  retryAfterSeconds?: number;
}
