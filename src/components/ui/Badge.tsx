import React from 'react';

export type BadgeVariant = 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'info' 
  | 'neutral' 
  | 'primary';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { container: string; dot: string }> = {
  success: {
    container: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  warning: {
    container: 'bg-amber-50 text-amber-700 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  danger: {
    container: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500',
  },
  info: {
    container: 'bg-sky-50 text-sky-700 border-sky-200/80',
    dot: 'bg-sky-500',
  },
  primary: {
    container: 'bg-primary-50 text-primary-700 border-primary-200/80',
    dot: 'bg-primary-600',
  },
  neutral: {
    container: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  icon,
  className = '',
  ...props
}) => {
  const styles = variantStyles[variant];
  const sizeClasses = size === 'sm' 
    ? 'text-[10px] px-2 py-0.5 font-bold' 
    : 'text-xs px-2.5 py-1 font-semibold';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border tracking-wide uppercase select-none
        ${styles.container}
        ${sizeClasses}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />
      )}
      {icon && (
        <span className="inline-flex shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </span>
  );
};
