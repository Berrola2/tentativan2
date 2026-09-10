import React, { useState } from 'react';
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
  MoreHorizontal,
  X,
  CreditCard,
  PenTool,
  Mic,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export interface BottomNavProps {
  activeNav?: string;
  onNavigate?: (id: string) => void;
  className?: string;
}

interface BottomNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export const BottomNav: React.FC<BottomNavProps> = ({
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

  const [isMoreDrawerOpen, setIsMoreDrawerOpen] = useState(false);

  // Determinar itens principais e itens do drawer "Mais"
  const getNavStructure = (): { primary: BottomNavItem[]; more: BottomNavItem[] } => {
    if (isSuperAdmin) {
      return {
        primary: [
          { id: 'companies', label: 'Empresas', icon: <Building2 className="w-5 h-5" /> },
          { id: 'audit', label: 'Auditoria', icon: <ShieldCheck className="w-5 h-5" /> },
          { id: 'system', label: 'Sistema', icon: <Server className="w-5 h-5" /> },
        ],
        more: [],
      };
    }

    if (isCompanyManager) {
      return {
        primary: [
          { id: 'dashboard', label: 'Início', icon: <LayoutDashboard className="w-5 h-5" /> },
          { id: 'inspections', label: 'Vistorias', icon: <FileText className="w-5 h-5" /> },
          { id: 'properties', label: 'Imóveis', icon: <Building className="w-5 h-5" /> },
          { id: 'comparisons', label: 'Confrontos', icon: <GitCompare className="w-5 h-5" /> },
        ],
        more: [
          { id: 'employees', label: 'Funcionários & Equipe', icon: <Users className="w-5 h-5" /> },
          { id: 'signatures', label: 'Gestão de Assinaturas', icon: <PenTool className="w-5 h-5" /> },
          { id: 'billing', label: 'Plano SaaS & Cobrança', icon: <CreditCard className="w-5 h-5" /> },
        ],
      };
    }

    if (isInspector) {
      return {
        primary: [
          { id: 'inspections', label: 'Vistorias', icon: <FileText className="w-5 h-5" /> },
          { id: 'comparisons', label: 'Confrontos', icon: <GitCompare className="w-5 h-5" /> },
          { id: 'properties', label: 'Imóveis', icon: <Building className="w-5 h-5" /> },
          { id: 'audio-inspection', label: 'Áudio / IA', icon: <Mic className="w-5 h-5" /> },
        ],
        more: [],
      };
    }

    if (isViewer) {
      return {
        primary: [
          { id: 'inspections', label: 'Vistorias', icon: <FileText className="w-5 h-5" /> },
          { id: 'properties', label: 'Imóveis', icon: <Building className="w-5 h-5" /> },
          { id: 'comparisons', label: 'Confrontos', icon: <GitCompare className="w-5 h-5" /> },
        ],
        more: [],
      };
    }

    return { primary: [], more: [] };
  };

  const { primary, more } = getNavStructure();
  const hasMore = more.length > 0;

  const handleSelect = (id: string) => {
    if (onNavigate) onNavigate(id);
    setIsMoreDrawerOpen(false);
  };

  return (
    <>
      {/* Barra Fixa Inferior (Mobile Only) */}
      <nav 
        className={`
          sm:hidden fixed bottom-0 left-0 right-0 z-40
          bg-white/95 backdrop-blur-md border-t border-yzzy-border shadow-floating
          safe-bottom select-none
          ${className}
        `}
      >
        <div className="flex items-center justify-around h-16 px-1">
          {primary.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`
                  flex flex-col items-center justify-center flex-1 h-full min-h-[44px] px-1 py-1 gap-1
                  transition-colors outline-none
                  ${isActive 
                    ? 'text-primary-600 font-bold' 
                    : 'text-yzzy-text-muted hover:text-yzzy-text-primary'
                  }
                `}
              >
                <span className={`transition-transform ${isActive ? 'scale-110 text-primary-600' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-[10px] tracking-tight truncate max-w-[64px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Botão "Mais" se houver itens adicionais ou perfil */}
          <button
            type="button"
            onClick={() => setIsMoreDrawerOpen(true)}
            className={`
              flex flex-col items-center justify-center flex-1 h-full min-h-[44px] px-1 py-1 gap-1
              transition-colors outline-none
              ${isMoreDrawerOpen 
                ? 'text-primary-600 font-bold' 
                : 'text-yzzy-text-muted hover:text-yzzy-text-primary'
              }
            `}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Mais</span>
          </button>
        </div>
      </nav>

      {/* Drawer Mobile "Mais" */}
      {isMoreDrawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
            onClick={() => setIsMoreDrawerOpen(false)}
          />

          {/* Sheet */}
          <div className="relative bg-white rounded-t-modal border-t border-yzzy-border p-5 pb-8 safe-bottom shadow-floating animate-slideUp z-10">
            <div className="flex items-center justify-between pb-3 border-b border-yzzy-border/60 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-btn bg-primary-600 flex items-center justify-center text-white font-bold shadow-xs">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-yzzy-text-primary font-display">
                    {companyName || 'Vistoria YZZY'}
                  </h4>
                  {companySlug && (
                    <p className="text-[10px] font-mono text-yzzy-text-muted">
                      @{companySlug}.yzzy
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMoreDrawerOpen(false)}
                className="p-1.5 rounded-btn text-yzzy-text-muted hover:text-yzzy-text-primary hover:bg-surface-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Extra */}
            {hasMore && (
              <div className="space-y-1 mb-4">
                <div className="text-[10px] font-bold text-yzzy-text-muted uppercase tracking-wider px-2 mb-1.5 text-left">
                  Módulos Adicionais
                </div>
                {more.map((item) => {
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.id)}
                      className={`
                        w-full flex items-center gap-3 px-3 py-3 rounded-btn text-xs font-semibold
                        transition-colors text-left
                        ${isActive 
                          ? 'bg-primary-50 text-primary-700 font-bold border border-primary-100' 
                          : 'text-yzzy-text-primary hover:bg-surface-secondary'
                        }
                      `}
                    >
                      <span className={isActive ? 'text-primary-600' : 'text-yzzy-text-muted'}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Perfil & Logout */}
            <div className="pt-3 border-t border-yzzy-border/60 flex items-center justify-between">
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-yzzy-text-primary">
                  {user?.displayName || user?.fullName}
                </span>
                <span className="text-[10px] text-yzzy-text-muted">
                  {user?.username}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMoreDrawerOpen(false);
                  logout();
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-status-danger bg-rose-50 hover:bg-rose-100 rounded-btn transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
