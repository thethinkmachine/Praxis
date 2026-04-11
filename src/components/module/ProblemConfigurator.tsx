import React from 'react';
import { ChevronLeft } from '@/components/shared/Icons';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import PanelWrapper from '@/components/layout/PanelWrapper';

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
  return <CollapsibleSection title={title} defaultOpen={defaultOpen}>{children}</CollapsibleSection>;
}

export default function ProblemConfigurator({
  children,
  title = 'Configure',
  onBack,
}: ProblemConfiguratorProps) {
  return (
    <PanelWrapper
      title={title}
      className="border-l-0"
      headerLeading={onBack ? (
        <button
          onClick={onBack}
          className="ui-btn ui-btn-ghost ui-btn-icon h-7 w-7 rounded-md"
          title="Back"
        >
          <ChevronLeft size={14} />
        </button>
      ) : undefined}
    >
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[var(--surface)]/30">
        <div className="custom-scrollbar h-full min-h-0 flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </PanelWrapper>
  );
}
