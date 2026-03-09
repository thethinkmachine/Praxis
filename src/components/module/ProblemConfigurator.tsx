import React from 'react';
import { ChevronLeft } from '@/components/shared/Icons';

interface ProblemConfiguratorProps {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
}

export default function ProblemConfigurator({
  children,
  title = 'Configure',
  onBack,
}: ProblemConfiguratorProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
      {/* Optional Header with Back Button */}
      {onBack && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/30">
          <button
            onClick={onBack}
            className="p-1 rounded-md hover:bg-[var(--surface-3)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            title="Back to Global Config"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-2)] truncate">
            {title}
          </span>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">{children}</div>
    </div>
  );
}
