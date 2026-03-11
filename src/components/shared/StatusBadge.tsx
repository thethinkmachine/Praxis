import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatusBadgeProps {
  children: ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
}

const TONE_CLASS: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  accent: 'ui-pill-accent',
  success: 'ui-pill-success',
  warning: 'ui-pill-warning',
  danger: 'ui-pill-danger',
  purple: 'ui-pill-purple',
  neutral: 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]',
};

export default function StatusBadge({ children, tone = 'neutral', size = 'sm', className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'ui-pill inline-flex items-center gap-1 font-medium',
        TONE_CLASS[tone],
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        className,
      )}
    >
      {children}
    </span>
  );
}