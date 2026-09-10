import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'ghost' 
  | 'danger' 
  | 'success' 
  | 'outline-primary'
  | 'icon';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 
    'bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white shadow-xs hover:shadow-subtle-blue focus-visible:ring-primary-500 border border-transparent',
  secondary: 
    'bg-white hover:bg-surface-secondary active:bg-surface-tertiary text-yzzy-text-primary border border-yzzy-border shadow-xs hover:border-slate-300 focus-visible:ring-primary-500',
  ghost: 
    'bg-transparent hover:bg-primary-50 active:bg-primary-100 text-yzzy-text-secondary hover:text-primary-700 border border-transparent focus-visible:ring-primary-500',
  danger: 
    'bg-status-danger hover:bg-red-600 active:bg-red-700 text-white shadow-xs focus-visible:ring-red-500 border border-transparent',
  success: 
    'bg-status-success hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-xs focus-visible:ring-emerald-500 border border-transparent',
  'outline-primary': 
    'bg-primary-50/60 hover:bg-primary-50 active:bg-primary-100 text-primary-700 border border-primary-200 focus-visible:ring-primary-500',
  icon: 
    'bg-transparent hover:bg-surface-secondary active:bg-surface-tertiary text-yzzy-text-secondary hover:text-yzzy-text-primary border border-yzzy-border/60 focus-visible:ring-primary-500 p-2',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs font-semibold gap-1.5 rounded-btn min-h-[32px]',
  md: 'px-3.5 py-2 text-sm font-semibold gap-2 rounded-btn min-h-[40px]',
  lg: 'px-4.5 py-2.5 text-base font-semibold gap-2.5 rounded-btn min-h-[46px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  className = '',
  type = 'button',
  ...props
}, ref) => {
  const isIconButton = variant === 'icon';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center select-none
        transition-all duration-default ease-out
        outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${variantStyles[variant]}
        ${!isIconButton ? sizeStyles[size] : 'rounded-btn'}
        ${disabled || isLoading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer active:scale-[0.98]'}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        <>
          {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
