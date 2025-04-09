import type { ReactNode } from 'react';

interface PlaceholderProps {
  className?: string;
  children?: ReactNode;
}

export function Placeholder({ className, children }: PlaceholderProps) {
  return (
    <div className={`flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md ${className}`}>
      {children || 'Placeholder content'}
    </div>
  );
} 