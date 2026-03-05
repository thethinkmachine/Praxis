import { Separator } from 'react-resizable-panels';
import { cn } from '@/lib/cn';

interface ResizeHandleProps {
  orientation: 'horizontal' | 'vertical';
}

export default function ResizeHandle({ orientation }: ResizeHandleProps) {
  return (
    <Separator
      className={cn(
        'group relative shrink-0 bg-transparent touch-none select-none flex items-center justify-center',
        orientation === 'horizontal'
          ? 'w-3 cursor-col-resize data-[dragging]:bg-[var(--accent-soft)]/40'
          : 'h-3 cursor-row-resize data-[dragging]:bg-[var(--accent-soft)]/40',
      )}
    >
      <div
        className={cn(
          'rounded-full bg-[var(--border)] transition-all duration-150 group-hover:bg-[var(--accent)] group-data-[dragging]:bg-[var(--accent)] group-data-[dragging]:shadow-[0_0_14px_rgba(95,179,255,0.45)]',
          orientation === 'horizontal' ? 'h-12 w-1.5' : 'h-1.5 w-12',
        )}
      />
    </Separator>
  );
}
