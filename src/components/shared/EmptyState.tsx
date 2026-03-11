import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export default function EmptyState({ title, description, icon, action, className, compact = false }: EmptyStateProps) {
  return (
    <div className={cn('flex h-full items-center justify-center', className)}>
      <div className={cn('flex max-w-sm flex-col items-center text-center', compact ? 'gap-1.5 px-4 py-3' : 'gap-3 px-6 py-6')}>
        {icon ? <div className="text-[var(--text-3)]">{icon}</div> : null}
        <p className={cn(compact ? 'text-sm' : 'text-base', 'font-medium text-[var(--text-2)]')}>{title}</p>
        {description ? (
          <p className={cn(compact ? 'text-xs' : 'text-sm', 'leading-relaxed text-[var(--text-3)]')}>{description}</p>
        ) : null}
        {action}
      </div>
    </div>
  );
}