import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import EmptyState from '@/components/shared/EmptyState';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import type { AlgorithmStep, PanelSection } from '@/types';

interface StatePanelProps {
  step: AlgorithmStep | null;
}

function Section({ 
  title, 
  count, 
  children, 
  defaultOpen = true 
}: { 
  title: string; 
  count?: number; 
  children: ReactNode; 
  defaultOpen?: boolean;
}) {
  return <CollapsibleSection title={title} count={count} defaultOpen={defaultOpen} bodyClassName="p-0">{children}</CollapsibleSection>;
}

type ChipVariant = 'frontier' | 'current' | 'explored' | 'path';

const CHIP_STYLES: Record<ChipVariant, string> = {
  frontier: 'bg-[var(--color-frontier)]/7 text-[var(--color-frontier)] border-[var(--color-frontier)]/20',
  current: 'bg-[var(--color-current)]/10 text-[var(--color-current)] border-[var(--color-current)]/30',
  explored: 'bg-[var(--color-explored)]/10 text-[var(--text-2)] border-[var(--color-explored)]/20',
  path: 'bg-[var(--color-goal)]/10 text-[var(--color-goal)] border-[var(--color-goal)]/25',
};

function ChipBadge({
  children,
  variant,
  title,
}: {
  children: ReactNode;
  variant: ChipVariant;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center px-[7px] py-[2px] rounded-[3px]',
        'font-mono text-[9px] border whitespace-nowrap',
        CHIP_STYLES[variant],
      )}
    >
      {children}
    </span>
  );
}

function NodeEntry({
  id,
  label,
  detail,
}: {
  id: string;
  label?: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-0.5 hover:bg-[var(--surface-2)]/50 transition-colors">
      <span className="text-xs font-mono truncate text-[var(--text)]">
        {label ?? id}
      </span>
      {detail && (
        <span className="ml-auto text-[10px] text-[var(--text-2)] shrink-0">{detail}</span>
      )}
    </div>
  );
}

function renderPanel(panel: PanelSection, idx: number) {
  return (
    <Section key={idx} title={panel.title} count={panel.count}>
      {panel.type === 'key-value' && (
        <div className="px-3 py-2 space-y-1 text-[11px] text-[var(--text-2)]">
          {panel.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span>{item.key}</span>
              <span className="font-mono text-[var(--text)]">{item.value}</span>
            </div>
          ))}
        </div>
      )}
      {panel.type === 'chips' && (
        <div className="px-3 py-2 flex flex-wrap gap-1.5">
          {panel.items.length > 0 ? panel.items.map((item, i) => (
            item.variant === 'path' ? (
              <span key={i} className="inline-flex items-center gap-1">
                <ChipBadge variant="path" title={item.detail}>{item.label ?? item.id}</ChipBadge>
                {i < panel.items.length - 1 && <span className="text-[9px] text-[var(--text-3)]">&rarr;</span>}
              </span>
            ) : (
              <ChipBadge key={i} variant={item.variant ?? 'explored'} title={item.detail}>
                {item.label ?? item.id}
              </ChipBadge>
            )
          )) : (
            <div className="text-[var(--text-3)]">Empty</div>
          )}
        </div>
      )}
      {panel.type === 'nodes' && (
        <div className="py-1">
          {panel.items.length > 0 ? panel.items.map((item, i) => (
            <NodeEntry key={i} id={item.id} label={item.label} detail={item.detail} />
          )) : (
            <div className="px-3 py-1 text-[var(--text-3)]">Empty</div>
          )}
        </div>
      )}
    </Section>
  );
}

export default function StatePanel({ step }: StatePanelProps) {
  if (!step) {
    return (
      <EmptyState title="No step selected" description="Run or step through an algorithm to inspect its active state." className="bg-[var(--surface)]" />
    );
  }

  const panels = step.statePanels ?? [];
  if (panels.length === 0) {
    return (
      <EmptyState
        title="No state panels available"
        description="This algorithm step did not emit panel data."
        className="bg-[var(--surface)]"
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
      <div className="flex-1 overflow-y-auto text-xs divide-y divide-[var(--border)]">
        {panels.map((panel, idx) => renderPanel(panel, idx))}
      </div>
    </div>
  );
}
