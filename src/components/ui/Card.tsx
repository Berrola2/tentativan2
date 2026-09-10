import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  interactive = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`
        bg-white border border-yzzy-border rounded-card shadow-xs text-left
        transition-all duration-default ease-out
        ${interactive ? 'yzzy-card-interactive cursor-pointer hover:border-slate-300' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-5 pb-3 flex flex-col gap-1 border-b border-yzzy-border/40 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <h3 className={`text-base font-bold text-yzzy-text-primary tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <p className={`text-xs text-yzzy-text-secondary leading-relaxed ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-5 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`p-4 px-5 bg-surface-secondary/50 border-t border-yzzy-border rounded-b-card flex items-center justify-between gap-3 ${className}`} {...props}>
    {children}
  </div>
);

// --- Componentes Específicos de Cartão ---

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  onClick,
  className = '',
}) => {
  return (
    <Card 
      interactive={!!onClick} 
      onClick={onClick}
      className={`p-5 flex flex-col justify-between gap-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-yzzy-text-secondary uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-btn bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div>
        <div className="text-2xl sm:text-3xl font-extrabold text-yzzy-text-primary tracking-tight font-display">
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span className={`text-xs font-bold ${trend.isPositive ? 'text-status-success' : 'text-status-danger'}`}>
                {trend.isPositive ? '↑' : '↓'} {trend.value}
              </span>
            )}
            {subtitle && (
              <span className="text-xs text-yzzy-text-muted">
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export interface ActionCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  title,
  description,
  icon,
  badge,
  onClick,
  className = '',
}) => {
  return (
    <Card
      interactive={!!onClick}
      onClick={onClick}
      className={`p-4 sm:p-5 flex items-center justify-between gap-4 group ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-btn bg-primary-50 text-primary-600 flex items-center justify-center shrink-0 group-hover:bg-primary-600 group-hover:text-white transition-colors duration-default">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-yzzy-text-primary group-hover:text-primary-600 transition-colors truncate">
              {title}
            </h4>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-yzzy-text-secondary truncate mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      {onClick && (
        <ChevronRight className="w-5 h-5 text-yzzy-text-muted group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all shrink-0" />
      )}
    </Card>
  );
};
