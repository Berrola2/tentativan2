import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rounded' | 'card';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rounded',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const variantClass = {
    text: 'h-4 w-full rounded',
    circular: 'rounded-full',
    rounded: 'rounded-input',
    card: 'rounded-card h-28 w-full',
  }[variant];

  return (
    <div
      className={`
        bg-slate-200/80 animate-pulse
        ${variantClass}
        ${className}
      `}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...props}
    />
  );
};
