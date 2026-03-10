import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';

interface ProblemConfiguratorProps {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
}

export function ConfigSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <div
        className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-2)]/50 hover:bg-[var(--surface-3)]/80 cursor-pointer select-none transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-[var(--text-3)]">
          {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
        <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-2)]">
          {title}
        </span>
      </div>
      {isOpen && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
}

export default function ProblemConfigurator({
  children,
  title = 'Configure',
  onBack,
}: ProblemConfiguratorProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/50 shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 rounded-md hover:bg-[var(--surface-3)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
            title="Back"
          >
            <ChevronLeft size={14} />
          </button>
        )}
        <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-2)] truncate">
          {title}
        </span>
      </div>

      {/* Body area (can contain flat children or ConfigSections) */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[var(--surface)]">
        {children}
      </div>
    </div>
  );
}
