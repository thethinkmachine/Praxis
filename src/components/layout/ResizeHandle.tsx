import { Separator } from 'react-resizable-panels';
import { cn } from '@/lib/cn';

interface ResizeHandleProps {
  orientation: 'horizontal' | 'vertical';
}

export default function ResizeHandle({ orientation }: ResizeHandleProps) {
  return (
    <Separator
      className={cn(
        'relative shrink-0 bg-transparent before:absolute before:content-[""] before:transition-colors before:bg-[var(--border)]',
        orientation === 'horizontal'
          ? 'w-2 cursor-col-resize before:w-px before:h-full before:top-0 before:left-1/2 before:-translate-x-1/2 hover:before:bg-[var(--accent)]/60'
          : 'h-2 cursor-row-resize before:h-px before:w-full before:left-0 before:top-1/2 before:-translate-y-1/2 hover:before:bg-[var(--accent)]/60',
      )}
    />
  );
}
