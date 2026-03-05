import React from 'react';

interface ProblemConfiguratorProps {
  children: React.ReactNode;
  title?: string;
}

export default function ProblemConfigurator({
  children,
  title = 'Configure',
}: ProblemConfiguratorProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-3 py-1.5 border-b border-[var(--border)] shrink-0">
        <span className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider">
          {title}
        </span>
      </div>
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">{children}</div>
    </div>
  );
}
