import React from 'react';
import { 
  Building2, 
  Building,
  FileText, 
  GitCompare, 
  Users, 
  ShieldCheck, 
  Server, 
  LayoutDashboard, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  CreditCard,
  PenTool,
  Mic
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Tooltip } from '../ui/Tooltip';
import { Badge } from '../ui/Badge';

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeNav?: string;
  onNavigate?: (id: string) => void;
  className?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  activeNav,
  onNavigate,
  className = '',
}) => {
  const { 
    user, 
    isSuperAdmin, 
    isCompanyManager, 
    isInspector, 
    isViewer, 
    companyName, 
    companySlug, 
    logout 
  } = useAuth();

  // Obter itens de menu conformes ao papel do usuário
  const getNavItems = (): NavItem[] => {
    if (isSuperAdmin) {
      return [
        { id: 'companies', label: 'Empresas & Tenants', icon: <Building2 className="w-5 h-5" /> },
        { id: 'audit', label: 'Auditoria de Segurança', icon: <ShieldCheck className="w-5 h-5" /> },
        { id: 'system', label: 'Saúde do Sistema', icon: <Server className="w-5 h-5" /> },
      ];
    }

    if (isCompanyManager) {
      return [
        { id: 'dashboard', label: 'Painel Geral', icon: <LayoutDashboard className="w-5 h-5" /> },
        { id: 'inspections', label: 'Vistorias', icon: <FileText className="w-5 h-5" /> },
        { id: 'properties', label: 'Imóveis', icon: <Building className="w-5 h-5" /> },
        { id: 'comparisons', label: 'Confrontos', icon: <GitCompare className="w-5 h-5" /> },
        { id: 'employees', label: 'Funcionários', icon: <Users className="w-5 h-5" /> },
        { id: 'signatures', label: 'Assinaturas', icon: <PenTool className="w-5 h-5" /> },
        { id: 'billing', label: 'Plano & Cobrança', icon: <CreditCard className="w-5 h-5" /> },
      ];
    }

    if (isInspector) {
      return [
        { id: 'inspections', label: 'Minhas Vistorias', icon: <FileText className="w-5 h-5" /> },
        { id: 'comparisons', label: 'Confrontos', icon: <GitCompare className="w-5 h-5" /> },
        { id: 'properties', label: 'Imóveis', icon: <Building className="w-5 h-5" /> },
        { id: 'audio-inspection', label: 'Vistoria por Áudio', icon: <Mic className="w-5 h-5" /> },
      ];
    }

    if (isViewer) {
      return [
        { id: 'inspections', label: 'Vistorias da Empresa', icon: <FileText className="w-5 h-5" /> },
        { id: 'properties', label: 'Imóveis', icon: <Building className="w-5 h-5" /> },
        { id: 'comparisons', label: 'Confrontos', icon: <GitCompare className="w-5 h-5" /> },
      ];
    }

    return [];
  };

  const navItems = getNavItems();

  // Iniciais do Usuário
  const getInitials = (name?: string) => {
    if (!name) return 'YZ';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Papel formatado
  const getRoleBadge = () => {
    if (isSuperAdmin) return { label: 'SUPER ADMIN', variant: 'primary' as const };
    if (isCompanyManager) return { label: 'GERENTE', variant: 'success' as const };
    if (isInspector) return { label: 'VISTORIADOR', variant: 'info' as const };
    if (isViewer) return { label: 'AUDITOR', variant: 'neutral' as const };
    return { label: 'USUÁRIO', variant: 'neutral' as const };
  };

  const roleInfo = getRoleBadge();

  return (
    <aside
      className={`
        hidden sm:flex flex-col bg-white border-r border-yzzy-border z-30
        transition-all duration-default ease-in-out select-none
        ${isCollapsed ? 'w-[72px]' : 'w-64'}
        ${className}
      `}
    >
      {/* 1. Header com Branding YZZY */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-yzzy-border/60">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Logo YZZY Simbólico */}
          <div className="w-9 h-9 rounded-btn bg-primary-600 flex items-center justify-center text-white font-extrabold shadow-xs shrink-0 tracking-tighter">
            <Sparkles className="w-5 h-5 text-white" />
          </div>

          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-extrabold text-sm text-yzzy-text-primary tracking-tight font-display flex items-center gap-1.5">
                Vistoria <span className="text-primary-600">YZZY</span>
              </span>
              <span className="text-[10px] text-yzzy-text-muted truncate">
                {companyName || 'Plataforma SaaS'}
              </span>
            </div>
          )}
        </div>

        {/* Botão de Colapso */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`
            p-1.5 rounded-btn text-yzzy-text-muted hover:text-yzzy-text-primary hover:bg-surface-secondary
            border border-transparent hover:border-yzzy-border transition-colors shrink-0
            ${isCollapsed ? 'mx-auto' : ''}
          `}
          title={isCollapsed ? 'Expandir Menu' : 'Recolher Menu'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. Tenant / Identificação da Empresa (se não for Super Admin) */}
      {!isSuperAdmin && !isCollapsed && (
        <div className="px-4 py-2.5 bg-surface-secondary/60 border-b border-yzzy-border/40">
          <div className="text-[11px] font-semibold text-yzzy-text-secondary truncate">
            {companyName}
          </div>
          {companySlug && (
            <div className="text-[10px] font-mono text-yzzy-text-muted truncate">
              @{companySlug}.yzzy
            </div>
          )}
        </div>
      )}

      {/* 3. Lista de Navegação Principal */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeNav === item.id;

          const buttonContent = (
            <button
              type="button"
              onClick={() => onNavigate && onNavigate(item.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-xs font-semibold
                transition-all duration-default text-left outline-none
                ${isActive 
                  ? 'bg-primary-50 text-primary-700 font-bold border border-primary-100 shadow-xs' 
                  : 'text-yzzy-text-secondary hover:text-yzzy-text-primary hover:bg-surface-secondary/80 border border-transparent'
                }
                ${isCollapsed ? 'justify-center px-2' : ''}
              `}
            >
              <span className={`shrink-0 ${isActive ? 'text-primary-600' : 'text-yzzy-text-muted'}`}>
                {item.icon}
              </span>

              {!isCollapsed && (
                <span className="flex-1 truncate">
                  {item.label}
                </span>
              )}

              {!isCollapsed && item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-bold">
                  {item.badge}
                </span>
              )}
            </button>
          );

          if (isCollapsed) {
            return (
              <Tooltip key={item.id} content={item.label} position="right">
                {buttonContent}
              </Tooltip>
            );
          }

          return <div key={item.id}>{buttonContent}</div>;
        })}
      </nav>

      {/* 4. Rodapé do Usuário / Logout */}
      <div className="p-3 border-t border-yzzy-border bg-surface-secondary/40">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center border border-primary-200 shrink-0">
              {getInitials(user?.displayName || user?.fullName)}
            </div>

            {!isCollapsed && (
              <div className="min-w-0 flex flex-col text-left">
                <span className="text-xs font-bold text-yzzy-text-primary truncate">
                  {user?.displayName || user?.fullName || 'Usuário'}
                </span>
                <Badge variant={roleInfo.variant} size="sm" className="mt-0.5 w-fit">
                  {roleInfo.label}
                </Badge>
              </div>
            )}
          </div>

          {/* Botão Sair */}
          <button
            type="button"
            onClick={() => logout()}
            className="p-1.5 rounded-btn text-yzzy-text-muted hover:text-status-danger hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-colors"
            title="Sair do sistema"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
