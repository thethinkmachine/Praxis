import type { ReactNode } from 'react';
import { Eye, EyeOff } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';

interface PanelWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
  headerLeading?: ReactNode;
  headerTrailing?: ReactNode;
}

export default function PanelWrapper({
  title,
  subtitle,
  children,
  collapsed = false,
  onToggleCollapse,
  className,
  headerLeading,
  headerTrailing,
}: PanelWrapperProps) {
  return (
    <div
      className={cn(
        'ui-panel h-full flex flex-col overflow-hidden border-l border-[var(--border)]/70',
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--border-strong)] bg-[var(--titlebar)] px-3">
        <span className="h-[18px] w-[2px] shrink-0 rounded-full bg-[var(--accent)]/50" />
        {headerLeading}
        <span className="flex-1 truncate select-none text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text)]">
          {title}
        </span>
        {subtitle && (
          <span className="shrink-0 truncate text-[10px] font-mono text-[var(--text-3)] max-w-[140px]">{subtitle}</span>
        )}
        {headerTrailing}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-3)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-2)]"
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
