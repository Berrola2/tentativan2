import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { LoginView } from './components/LoginView';
import { ChangePasswordView } from './components/ChangePasswordView';
import { SuperAdminDashboard } from './components/dashboards/SuperAdminDashboard';
import { CompanyManagerDashboard } from './components/dashboards/CompanyManagerDashboard';
import { InspectorDashboard } from './components/dashboards/InspectorDashboard';
import { ViewerDashboard } from './components/dashboards/ViewerDashboard';
import { ExternalSignView } from './components/documents/ExternalSignView';
import { DocumentVerificationView } from './components/documents/DocumentVerificationView';
import { OfflineStatusBar } from './components/offline/OfflineStatusBar';
import { SyncCenterModal } from './components/offline/SyncCenterModal';
import { ConflictResolverModal } from './components/offline/ConflictResolverModal';
import { PwaUpdateNotice } from './components/offline/PwaUpdateNotice';
import { Loader2 } from 'lucide-react';

function AppRouter() {
  // Rotas Públicas (Sem necessidade de login)
  const [publicRoute, setPublicRoute] = useState<{
    type: 'SIGN' | 'VERIFY' | 'APP';
    param?: string;
  }>({ type: 'APP' });

  useEffect(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);

    // 1. Rota de Assinatura Externa: /sign/:token ou ?sign=:token
    if (path.startsWith('/sign/')) {
      const token = path.replace('/sign/', '').trim();
      if (token) {
        setPublicRoute({ type: 'SIGN', param: token });
        return;
      }
    } else if (searchParams.get('sign')) {
      setPublicRoute({ type: 'SIGN', param: searchParams.get('sign')! });
      return;
    }

    // 2. Rota de Verificação Pública: /verify/:code ou ?verify=:code
    if (path.startsWith('/verify/')) {
      const code = path.replace('/verify/', '').trim();
      if (code) {
        setPublicRoute({ type: 'VERIFY', param: code });
        return;
      }
    } else if (searchParams.get('verify')) {
      setPublicRoute({ type: 'VERIFY', param: searchParams.get('verify')! });
      return;
    }

    setPublicRoute({ type: 'APP' });
  }, []);

  if (publicRoute.type === 'SIGN' && publicRoute.param) {
    return <ExternalSignView token={publicRoute.param} />;
  }

  if (publicRoute.type === 'VERIFY' && publicRoute.param) {
    return <DocumentVerificationView verificationCode={publicRoute.param} />;
  }

  return <AuthenticatedAppRouter />;
}

function AuthenticatedAppRouter() {
  const { 
    isAuthenticated, 
    mustChangePassword, 
    isSuperAdmin, 
    isCompanyManager, 
    isInspector, 
    isViewer, 
    isLoading 
  } = useAuth();

  const [isSyncCenterOpen, setIsSyncCenterOpen] = useState(false);
  const [isConflictsOpen, setIsConflictsOpen] = useState(false);

  // 1. Tela de Carregamento Inicial
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Carregando Vistoria YZZY...
        </p>
      </div>
    );
  }

  // 2. Não Autenticado -> Tela de Login YZZY
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // 3. Primeiro Acesso / Senha Obrigatória -> Tela de Troca de Senha
  if (mustChangePassword) {
    return <ChangePasswordView />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Barra de Status Offline/Sincronização */}
      <OfflineStatusBar
        onOpenSyncCenter={() => setIsSyncCenterOpen(true)}
        onOpenConflicts={() => setIsConflictsOpen(true)}
      />

      {/* Roteamento por Papel RBAC */}
      <div className="flex-1">
        {isSuperAdmin && <SuperAdminDashboard />}
        {isCompanyManager && <CompanyManagerDashboard />}
        {isInspector && <InspectorDashboard />}
        {isViewer && <ViewerDashboard />}
      </div>

      {/* Modais Globais de Sincronização e PWA */}
      <SyncCenterModal
        isOpen={isSyncCenterOpen}
        onClose={() => setIsSyncCenterOpen(false)}
        onOpenConflicts={() => {
          setIsSyncCenterOpen(false);
          setIsConflictsOpen(true);
        }}
      />

      <ConflictResolverModal
        isOpen={isConflictsOpen}
        onClose={() => setIsConflictsOpen(false)}
      />

      <PwaUpdateNotice />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ToastProvider>
  );
}
