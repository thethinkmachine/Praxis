import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: 'default' | 'muted' | 'strong';
  padding?: 'sm' | 'md' | 'lg';
}

const TONE_CLASS: Record<NonNullable<SurfaceCardProps['tone']>, string> = {
  default: 'bg-[var(--surface)] border-[var(--border)]',
  muted: 'bg-[var(--surface)]/78 border-[var(--border)] backdrop-blur-[5px]',
  strong: 'bg-[var(--surface-2)]/65 border-[var(--border)]',
};

const PADDING_CLASS: Record<NonNullable<SurfaceCardProps['padding']>, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export default function SurfaceCard({
  children,
  className,
  tone = 'default',
  padding = 'md',
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border',
        TONE_CLASS[tone],
        PADDING_CLASS[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}