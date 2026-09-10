import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  type?: AlertType;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
}

const typeStyles: Record<AlertType, {
  container: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}> = {
  info: {
    container: 'bg-sky-50/80 border-sky-200 text-sky-900',
    icon: <Info className="w-5 h-5 text-sky-600 shrink-0" />,
    title: 'text-sky-950 font-bold',
    text: 'text-sky-800',
  },
  success: {
    container: 'bg-emerald-50/80 border-emerald-200 text-emerald-900',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    title: 'text-emerald-950 font-bold',
    text: 'text-emerald-800',
  },
  warning: {
    container: 'bg-amber-50/80 border-amber-200 text-amber-900',
    icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    title: 'text-amber-950 font-bold',
    text: 'text-amber-800',
  },
  error: {
    container: 'bg-rose-50/80 border-rose-200 text-rose-900',
    icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    title: 'text-rose-950 font-bold',
    text: 'text-rose-800',
  },
};

export const Alert: React.FC<AlertProps> = ({
  children,
  type = 'info',
  title,
  icon,
  onClose,
  className = '',
  ...props
}) => {
  const styles = typeStyles[type];

  return (
    <div
      className={`
        p-4 rounded-card border flex items-start gap-3.5 text-left text-xs leading-relaxed
        ${styles.container}
        ${className}
      `}
      role="alert"
      {...props}
    >
      {icon || styles.icon}
      
      <div className="flex-1 min-w-0">
        {title && (
          <h5 className={`text-sm ${styles.title} mb-0.5`}>
            {title}
          </h5>
        )}
        <div className={styles.text}>
          {children}
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1 -mr-1 -mt-1 rounded text-current opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Fechar alerta"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
