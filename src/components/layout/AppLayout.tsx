import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { useAuth } from '../../contexts/AuthContext';

export interface AppLayoutProps {
  children: React.ReactNode;
  activeNav?: string;
  onNavigate?: (id: string) => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  statusNode?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeNav,
  onNavigate,
  title,
  subtitle,
  statusNode,
}) => {
  const { companyName, isSuperAdmin } = useAuth();

  // Persistência local da preferência de colapso da sidebar
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('yzzy_sidebar_collapsed');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('yzzy_sidebar_collapsed', JSON.stringify(next));
      } catch {
        // Ignore localStorage error
      }
      return next;
    });
  };

  // Título padrão se não fornecido
  const defaultTitle = isSuperAdmin ? 'Administração Global' : (companyName || 'Painel Principal');

  return (
    <div className="min-h-screen bg-yzzy-canvas flex text-yzzy-text-primary font-sans antialiased selection:bg-primary-600 selection:text-white">
      {/* 1. Sidebar Desktop/Tablet */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
        activeNav={activeNav}
        onNavigate={onNavigate}
      />

      {/* 2. Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 sm:pb-0">
        {/* Topbar */}
        <Topbar
          title={title || defaultTitle}
          subtitle={subtitle}
          statusNode={statusNode}
        />

        {/* Conteúdo Dinâmico */}
        <div className="flex-1 overflow-x-hidden">
          {children}
        </div>
      </div>

      {/* 3. Navegação Móvel Inferior (Telas < 640px) */}
      <BottomNav
        activeNav={activeNav}
        onNavigate={onNavigate}
      />
    </div>
  );
};
