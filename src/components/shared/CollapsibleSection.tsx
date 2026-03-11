import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ChevronDown, ChevronRight } from '@/components/shared/Icons';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
  headerClassName?: string;
  bodyClassName?: string;
  className?: string;
}

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  count,
  headerClassName,
  bodyClassName,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn('border-b border-[var(--border)] last:border-0', className)}>
      <div
        className={cn(
          'flex cursor-pointer select-none items-center gap-2 px-3 py-1.5 transition-colors hover:bg-[var(--surface-3)]/80',
          'bg-[var(--surface-2)]/50',
          headerClassName,
        )}
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="text-[var(--text-3)]">{isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}</span>
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-2)]">{title}</span>
        {count !== undefined ? (
          <span className="rounded-full bg-[var(--border)]/50 px-1.5 py-0.5 text-[9px] font-mono leading-none text-[var(--text-3)]">
            {count}
          </span>
        ) : null}
      </div>
      {isOpen ? <div className={cn('space-y-3 p-3', bodyClassName)}>{children}</div> : null}
    </div>
  );
}