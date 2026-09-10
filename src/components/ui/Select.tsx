import React, { forwardRef } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  isRequired?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  helperText,
  options,
  children,
  isRequired,
  disabled,
  className = '',
  id,
  ...props
}, ref) => {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label 
          htmlFor={selectId} 
          className="text-xs font-semibold text-yzzy-text-primary flex items-center gap-1"
        >
          {label}
          {isRequired && <span className="text-status-danger">*</span>}
        </label>
      )}

      <div className="relative flex items-center w-full">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={`
            w-full bg-white text-sm text-yzzy-text-primary
            border rounded-input py-2.5 pl-3.5 pr-10 min-h-[42px] appearance-none
            transition-all duration-default ease-out
            outline-none cursor-pointer
            ${error 
              ? 'border-status-danger focus:border-status-danger focus:ring-2 focus:ring-red-500/20' 
              : 'border-yzzy-border hover:border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
            }
            ${disabled ? 'bg-surface-secondary text-yzzy-text-muted cursor-not-allowed opacity-60' : ''}
            ${className}
          `}
          {...props}
        >
          {options ? options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          )) : children}
        </select>

        <div className="absolute right-3 flex items-center pointer-events-none text-yzzy-text-muted">
          {error ? <AlertCircle className="w-4 h-4 text-status-danger" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {error ? (
        <p className="text-xs text-status-danger font-medium flex items-center gap-1 mt-0.5">
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

Select.displayName = 'Select';
