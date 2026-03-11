import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import SurfaceCard from '@/components/shared/SurfaceCard';

interface StatTileProps {
  label: string;
  value: ReactNode;
  valueColor?: string;
  compact?: boolean;
  className?: string;
}

export default function StatTile({ label, value, valueColor, compact = false, className }: StatTileProps) {
  return (
    <SurfaceCard tone="strong" padding={compact ? 'sm' : 'md'} className={cn('flex flex-col', className)}>
      <span
        className={cn(
          'font-mono font-light leading-none tracking-tight',
          compact ? 'text-xs' : typeof value === 'string' && value.length > 6 ? 'text-base' : 'text-2xl',
          valueColor ?? 'text-[var(--accent)]',
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-[8px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        {label}
      </span>
    </SurfaceCard>
  );
}