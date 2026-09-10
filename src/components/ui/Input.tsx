import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isRequired?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  isRequired,
  disabled,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label 
          htmlFor={inputId} 
          className="text-xs font-semibold text-yzzy-text-primary flex items-center gap-1"
        >
          {label}
          {isRequired && <span className="text-status-danger">*</span>}
        </label>
      )}

      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-3 flex items-center pointer-events-none text-yzzy-text-muted">
            {leftIcon}
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          className={`
            w-full bg-white text-sm text-yzzy-text-primary placeholder:text-yzzy-text-muted
            border rounded-input py-2.5 px-3.5 min-h-[42px]
            transition-all duration-default ease-out
            outline-none
            ${leftIcon ? 'pl-9' : ''}
            ${rightIcon || error ? 'pr-9' : ''}
            ${error 
              ? 'border-status-danger focus:border-status-danger focus:ring-2 focus:ring-red-500/20 text-red-950' 
              : 'border-yzzy-border hover:border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
            }
            ${disabled ? 'bg-surface-secondary text-yzzy-text-muted cursor-not-allowed opacity-60' : ''}
            ${className}
          `}
          {...props}
        />

        {error ? (
          <div className="absolute right-3 flex items-center pointer-events-none text-status-danger">
            <AlertCircle className="w-4 h-4" />
          </div>
        ) : rightIcon ? (
          <div className="absolute right-3 flex items-center text-yzzy-text-muted">
            {rightIcon}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-status-danger font-medium flex items-center gap-1 mt-0.5 animate-fadeIn">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs text-yzzy-text-muted mt-0.5">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
