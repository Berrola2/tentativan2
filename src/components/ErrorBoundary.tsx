import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[YZZY ErrorBoundary] Erro interceptado:', error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[320px] w-full flex flex-col items-center justify-center p-6 text-center bg-yzzy-canvas rounded-2xl border border-yzzy-border">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-xs">
            <AlertTriangle className="w-6 h-6" />
          </div>
          
          <h3 className="text-base font-bold text-yzzy-text-primary mb-1.5 font-display">
            {this.props.fallbackTitle || 'Não foi possível carregar esta tela.'}
          </h3>
          
          <p className="text-xs text-yzzy-text-secondary max-w-sm mb-5 leading-relaxed">
            {this.props.fallbackMessage || 'Ocorreu um erro temporário na interface. Seus dados salvos permanecem seguros.'}
          </p>

          <Button
            variant="primary"
            size="md"
            onClick={this.handleRetry}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
