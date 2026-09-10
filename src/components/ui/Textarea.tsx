import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  helperText,
  isRequired,
  disabled,
  className = '',
  rows = 3,
  id,
  ...props
}, ref) => {
  const textareaId = id || (label ? `textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label 
          htmlFor={textareaId} 
          className="text-xs font-semibold text-yzzy-text-primary flex items-center gap-1"
        >
          {label}
          {isRequired && <span className="text-status-danger">*</span>}
        </label>
      )}

      <div className="relative w-full">
        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          rows={rows}
          className={`
            w-full bg-white text-sm text-yzzy-text-primary placeholder:text-yzzy-text-muted
            border rounded-input py-2.5 px-3.5
            transition-all duration-default ease-out
            outline-none resize-y min-h-[80px]
            ${error 
              ? 'border-status-danger focus:border-status-danger focus:ring-2 focus:ring-red-500/20 text-red-950' 
              : 'border-yzzy-border hover:border-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20'
            }
            ${disabled ? 'bg-surface-secondary text-yzzy-text-muted cursor-not-allowed opacity-60' : ''}
            ${className}
          `}
          {...props}
        />
      </div>

      {error ? (
        <p className="text-xs text-status-danger font-medium flex items-center gap-1 mt-0.5">
          <AlertCircle className="w-3.5 h-3.5" />
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

Textarea.displayName = 'Textarea';
