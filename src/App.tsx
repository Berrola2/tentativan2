import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { LoginView } from './components/LoginView';
import { OfflineStatusBar } from './components/offline/OfflineStatusBar';
import { SyncCenterModal } from './components/offline/SyncCenterModal';
import { ConflictResolverModal } from './components/offline/ConflictResolverModal';
import { PwaUpdateNotice } from './components/offline/PwaUpdateNotice';
import { AppLayout } from './components/layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/ui/Skeleton';
import { Loader2 } from 'lucide-react';

// Lazy loading para views pesadas e roteamento por papéis (Etapa 05 - Code Splitting)
const ChangePasswordView = lazy(() => import('./components/ChangePasswordView').then(m => ({ default: m.ChangePasswordView })));
const SuperAdminDashboard = lazy(() => import('./components/dashboards/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })));
const CompanyManagerDashboard = lazy(() => import('./components/dashboards/CompanyManagerDashboard').then(m => ({ default: m.CompanyManagerDashboard })));
const InspectorDashboard = lazy(() => import('./components/dashboards/InspectorDashboard').then(m => ({ default: m.InspectorDashboard })));
const ViewerDashboard = lazy(() => import('./components/dashboards/ViewerDashboard').then(m => ({ default: m.ViewerDashboard })));
const ExternalSignView = lazy(() => import('./components/documents/ExternalSignView').then(m => ({ default: m.ExternalSignView })));
const DocumentVerificationView = lazy(() => import('./components/documents/DocumentVerificationView').then(m => ({ default: m.DocumentVerificationView })));

// Fallback de carregamento estrutural calmo (previne Layout Shift)
function ViewSkeleton() {
  return (
    <div className="w-full space-y-4 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl w-full" />
    </div>
  );
}

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
    return (
      <ErrorBoundary fallbackTitle="Erro na assinatura do laudo">
        <Suspense fallback={
          <div className="min-h-screen bg-yzzy-canvas flex flex-col items-center justify-center p-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
            <p className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
              Carregando portal de assinatura...
            </p>
          </div>
        }>
          <ExternalSignView token={publicRoute.param} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (publicRoute.type === 'VERIFY' && publicRoute.param) {
    return (
      <ErrorBoundary fallbackTitle="Erro na verificação do laudo">
        <Suspense fallback={
          <div className="min-h-screen bg-yzzy-canvas flex flex-col items-center justify-center p-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
            <p className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
              Verificando autenticidade do documento...
            </p>
          </div>
        }>
          <DocumentVerificationView verificationCode={publicRoute.param} />
        </Suspense>
      </ErrorBoundary>
    );
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

  const [activeNav, setActiveNav] = useState<string>(() => {
    if (isSuperAdmin) return 'companies';
    if (isCompanyManager) return 'dashboard';
    if (isInspector) return 'inspections';
    if (isViewer) return 'inspections';
    return 'dashboard';
  });

  useEffect(() => {
    if (isSuperAdmin) setActiveNav('companies');
    else if (isCompanyManager) setActiveNav('dashboard');
    else if (isInspector) setActiveNav('inspections');
    else if (isViewer) setActiveNav('inspections');
  }, [isSuperAdmin, isCompanyManager, isInspector, isViewer]);

  const [isSyncCenterOpen, setIsSyncCenterOpen] = useState(false);
  const [isConflictsOpen, setIsConflictsOpen] = useState(false);

  // 1. Tela de Carregamento Inicial
  if (isLoading) {
    return (
      <div className="min-h-screen bg-yzzy-canvas flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
        <p className="text-xs font-bold text-yzzy-text-secondary uppercase tracking-wider">
          Carregando Vistoria YZZY...
        </p>
      </div>
    );
  }

  // 2. Não Autenticado -> Tela de Login YZZY
  if (!isAuthenticated) {
    return (
      <ErrorBoundary fallbackTitle="Erro no login">
        <LoginView />
      </ErrorBoundary>
    );
  }

  // 3. Primeiro Acesso / Senha Obrigatória -> Tela de Troca de Senha
  if (mustChangePassword) {
    return (
      <ErrorBoundary fallbackTitle="Erro na alteração de senha">
        <Suspense fallback={
          <div className="min-h-screen bg-yzzy-canvas flex flex-col items-center justify-center p-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
          </div>
        }>
          <ChangePasswordView />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AppLayout
        activeNav={activeNav}
        onNavigate={setActiveNav}
        statusNode={
          <OfflineStatusBar
            onOpenSyncCenter={() => setIsSyncCenterOpen(true)}
            onOpenConflicts={() => setIsConflictsOpen(true)}
          />
        }
      >
        {/* Roteamento por Papel RBAC com Lazy Loading e Suspense */}
        <div className="w-full">
          <Suspense fallback={<ViewSkeleton />}>
            {isSuperAdmin && (
              <SuperAdminDashboard 
                activeNav={activeNav} 
                onNavigate={setActiveNav} 
              />
            )}
            {isCompanyManager && (
              <CompanyManagerDashboard 
                activeNav={activeNav} 
                onNavigate={setActiveNav} 
              />
            )}
            {isInspector && (
              <InspectorDashboard 
                activeNav={activeNav} 
                onNavigate={setActiveNav} 
              />
            )}
            {isViewer && (
              <ViewerDashboard 
                activeNav={activeNav} 
                onNavigate={setActiveNav} 
              />
            )}
          </Suspense>
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
      </AppLayout>
    </ErrorBoundary>
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
