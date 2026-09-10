import React, { useState, useRef, useEffect } from 'react';

export interface DropdownItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  items,
  align = 'right',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`
            absolute z-50 mt-1.5 w-52 rounded-card bg-white border border-yzzy-border shadow-floating
            py-1.5 focus:outline-none animate-scaleUp overflow-hidden
            ${align === 'right' ? 'right-0' : 'left-0'}
          `}
          role="menu"
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return <hr key={`divider-${idx}`} className="my-1 border-yzzy-border/60" />;
            }

            return (
              <button
                key={item.id || idx}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (item.onClick) item.onClick();
                  setIsOpen(false);
                }}
                className={`
                  w-full px-3.5 py-2 text-xs font-semibold flex items-center gap-2.5 text-left transition-colors
                  ${item.disabled ? 'opacity-50 cursor-not-allowed text-yzzy-text-muted' : 'cursor-pointer'}
                  ${item.danger 
                    ? 'text-status-danger hover:bg-rose-50' 
                    : 'text-yzzy-text-primary hover:bg-primary-50 hover:text-primary-700'
                  }
                `}
                role="menuitem"
              >
                {item.icon && (
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
