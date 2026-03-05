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
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">{children}</div>
    </div>
  );
}
