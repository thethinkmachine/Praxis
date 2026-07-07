import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral';
  size?: 'sm' | 'md';
}

const TONE_CLASS: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  accent: 'ui-pill-accent',
  success: 'ui-pill-success',
  warning: 'ui-pill-warning',
  danger: 'ui-pill-danger',
  purple: 'ui-pill-purple',
  neutral: 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]',
};

const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(function StatusBadge(
  { children, tone = 'neutral', size = 'sm', className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'ui-pill inline-flex items-center gap-1 font-medium',
        TONE_CLASS[tone],
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs',
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
});

export default StatusBadge;
