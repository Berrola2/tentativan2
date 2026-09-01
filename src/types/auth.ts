export type UserRole = 
  | 'ROLE_MANAGER' 
  | 'ROLE_INSPECTOR' 
  | 'ROLE_ADMIN_VIEWER' 
  | 'ROLE_TENANT_CLIENT' 
  | 'ROLE_LANDLORD_CLIENT';

export interface AuthUser {
  id: string;
  companyId: string;
  username: string;
  fullName: string;
  role: UserRole;
  cpf?: string;
  creci?: string;
}

export interface Company {
  id: string;
  slug: string;
  corporateCode: string;
  tradeName: string;
  legalName?: string;
  cnpj?: string;
  phone?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export interface AuthSession {
  user: AuthUser;
  company: Company;
  token?: string;
  loggedAt: string;
}
