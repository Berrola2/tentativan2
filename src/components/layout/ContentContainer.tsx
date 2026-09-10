import React from 'react';

export interface ContentContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

export const ContentContainer: React.FC<ContentContainerProps> = ({
  children,
  maxWidth = '7xl',
  className = '',
  ...props
}) => {
  return (
    <main
      className={`
        w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6
        ${maxWidthClasses[maxWidth]}
        ${className}
      `}
      {...props}
    >
      {children}
    </main>
  );
};
