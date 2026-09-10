import React from 'react';
import { Menu, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Dropdown } from '../ui/Dropdown';

export interface TopbarProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  onOpenMobileMenu?: () => void;
  statusNode?: React.ReactNode;
}

export const Topbar: React.FC<TopbarProps> = ({
  title,
  subtitle,
  onOpenMobileMenu,
  statusNode,
}) => {
  const { user, isSuperAdmin, isCompanyManager, isInspector, isViewer, logout } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return 'YZ';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getRoleLabel = () => {
    if (isSuperAdmin) return 'Super Administrador';
    if (isCompanyManager) return 'Gerente';
    if (isInspector) return 'Vistoriador Oficial';
    if (isViewer) return 'Auditor / Leitura';
    return 'Usuário';
  };

  const userMenuItems = [
    {
      id: 'profile-header',
      label: (
        <div className="flex flex-col py-0.5">
          <span className="font-bold text-yzzy-text-primary text-xs">{user?.displayName || user?.fullName}</span>
          <span className="text-[10px] text-yzzy-text-muted">{user?.username}</span>
        </div>
      ),
      disabled: true,
    },
    { id: 'div-1', label: '', divider: true },
    {
      id: 'logout',
      label: 'Sair da Conta',
      icon: <LogOut className="w-4 h-4" />,
      danger: true,
      onClick: () => logout(),
    },
  ];

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-yzzy-border px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20 safe-top">
      {/* 1. Esquerda: Botão Menu Mobile + Título Contextual */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="sm:hidden p-2 -ml-1 rounded-btn text-yzzy-text-secondary hover:text-yzzy-text-primary hover:bg-surface-secondary border border-yzzy-border/60 transition-colors"
            aria-label="Abrir menu de navegação"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Marca Mobile */}
        <div className="sm:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-btn bg-primary-600 flex items-center justify-center text-white font-black shadow-xs">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-sm text-yzzy-text-primary tracking-tight font-display">
            YZZY
          </span>
        </div>

        {/* Título / Contexto Desktop */}
        <div className="hidden sm:flex flex-col text-left min-w-0">
          {title && (
            <h2 className="text-sm sm:text-base font-bold text-yzzy-text-primary tracking-tight truncate">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-[11px] text-yzzy-text-muted truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* 2. Direita: Status Online/Offline + Perfil */}
      <div className="flex items-center gap-3">
        {/* Status Component Integrado */}
        {statusNode}

        {/* Dropdown de Usuário */}
        <Dropdown
          trigger={
            <div className="flex items-center gap-2.5 p-1 rounded-btn hover:bg-surface-secondary transition-colors cursor-pointer border border-transparent hover:border-yzzy-border/60">
              <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-bold text-xs flex items-center justify-center border border-primary-200 shrink-0">
                {getInitials(user?.displayName || user?.fullName)}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-yzzy-text-primary leading-tight truncate max-w-[120px]">
                  {user?.displayName || user?.fullName}
                </span>
                <span className="text-[10px] text-yzzy-text-muted leading-tight">
                  {getRoleLabel()}
                </span>
              </div>
            </div>
          }
          items={userMenuItems}
        />
      </div>
    </header>
  );
};
