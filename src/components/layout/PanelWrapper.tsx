import { useState, type ReactNode } from 'react';
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
        'h-full flex flex-col overflow-hidden bg-[var(--surface)]',
        className,
      )}
    >
      {/* Header with drag handle */}
      <div className="drag-handle flex items-center gap-1.5 px-2 py-1 bg-[var(--surface-2)] border-b border-[var(--border)] cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical size={12} className="text-[var(--text-3)]" />
        <span className="text-[11px] font-medium text-[var(--text-2)] flex-1 truncate select-none">
          {title}
        </span>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-0.5 rounded text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
            aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {collapsed ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        )}
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}
