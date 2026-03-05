import type { ReactNode } from 'react';
import { GripVertical, Eye, EyeOff } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';

interface PanelWrapperProps {
  title: string;
  children: ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

export default function PanelWrapper({
  title,
  children,
  collapsed = false,
  onToggleCollapse,
  className,
}: PanelWrapperProps) {
  return (
    <div
      className={cn(
        'h-full flex flex-col overflow-hidden bg-[var(--surface)] border-l border-[var(--border)]/70',
        className,
      )}
    >
      {/* Header with drag handle */}
      <div className="drag-handle ide-titlebar flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--border)] cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical size={12} className="text-[var(--text-3)]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]/80" />
        <span className="ide-title text-[var(--text-2)] flex-1 truncate select-none">
          {title}
        </span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-0.5 rounded text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors border border-transparent hover:border-[var(--border)]"
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex-1 overflow-hidden bg-[var(--surface)]">
          {children}
        </div>
      )}
    </div>
  );
}
