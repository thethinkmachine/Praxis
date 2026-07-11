import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import EmptyState from '@/components/shared/EmptyState';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import StatTile from '@/components/shared/StatTile';
import type { AlgorithmStep, PanelSection, StepMetrics, MetricTile, StepPhase } from '@/types';

interface StateMetricsPanelProps {
  step: AlgorithmStep | null;
  showState: boolean;
  showMetrics: boolean;
}

// ── State sections (chips / nodes / key-value) ──────────────────────────────

type ChipVariant = 'frontier' | 'current' | 'explored' | 'path' | 'pruned' | 'strategy';

const CHIP_STYLES: Record<ChipVariant, string> = {
  frontier: 'bg-[var(--color-frontier)]/7 text-[var(--color-frontier)] border-[var(--color-frontier)]/20',
  current: 'bg-[var(--color-current)]/10 text-[var(--color-current)] border-[var(--color-current)]/30',
  explored: 'bg-[var(--color-explored)]/10 text-[var(--text-2)] border-[var(--color-explored)]/20',
  path: 'bg-[var(--color-goal)]/10 text-[var(--color-goal)] border-[var(--color-goal)]/25',
  pruned: 'bg-[var(--color-pruned)]/10 text-[var(--color-pruned)] border-[var(--color-pruned)]/25',
  strategy: 'bg-[var(--color-path)]/10 text-[var(--color-path)] border-[var(--color-path)]/25',
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

function StateSection({ panel }: { panel: PanelSection }) {
  return (
    <CollapsibleSection title={panel.title} count={panel.count} bodyClassName="p-0">
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
    </CollapsibleSection>
  );
}

// ── Metrics section ──────────────────────────────────────────────────────────

const PHASE_COLORS: Partial<Record<StepPhase, string>> = {
  expanding: 'ui-pill ui-pill-warning',
  visiting: 'ui-pill ui-pill-warning',
  found: 'ui-pill ui-pill-success',
  failed: 'ui-pill ui-pill-danger',
};

function fmtNum(v: number | string | undefined): string {
  if (v === undefined || v === null) return '–';
  if (typeof v === 'string') return v;
  if (!isFinite(v)) return '∞';
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(3);
}

function MetricsSection({
  metrics,
  phase,
  description,
}: {
  metrics: StepMetrics | MetricTile[];
  phase: StepPhase;
  description: string;
}) {
  const phaseClass = PHASE_COLORS[phase] ?? 'bg-[var(--surface-2)] text-[var(--text-2)]';

  return (
    <CollapsibleSection title="Metrics" headerClassName="sticky top-0 z-10">
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-[9px] px-1.5 py-0.5 font-medium rounded-full', phaseClass)}>
            {phase}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pb-2">
          {Array.isArray(metrics) ? (
            metrics.map((m, i) => (
              <StatTile
                key={i}
                label={m.label}
                value={fmtNum(m.value)}
                valueColor={m.color ?? 'text-[var(--text)]'}
                className={m.fullWidth ? 'col-span-2' : ''}
              />
            ))
          ) : (
            Object.entries(metrics)
              .filter(([, v]) => v !== undefined)
              .map(([key, val], i) => (
                <StatTile
                  key={i}
                  label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  value={fmtNum(val)}
                  valueColor="text-[var(--text)]"
                />
              ))
          )}
        </div>
        {description && (
          <p className="text-[10px] text-[var(--text-2)] border-t border-[var(--border)] pt-2 mt-1 leading-relaxed font-mono">
            {description}
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
// One scrollable list combining the algorithm's state sections and its metrics,
// rather than two separately-scrolling components stacked on top of each other.

export default function StateMetricsPanel({ step, showState, showMetrics }: StateMetricsPanelProps) {
  if (!step) {
    return (
      <EmptyState
        title="No step selected"
        description="Run or step through an algorithm to inspect its active state."
        className="h-full bg-[var(--surface)]"
      />
    );
  }

  const panels = step.statePanels ?? [];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar text-xs divide-y divide-[var(--border)] bg-[var(--surface)]">
      {showState && (
        panels.length > 0 ? (
          panels.map((panel, idx) => <StateSection key={idx} panel={panel} />)
        ) : (
          <EmptyState
            title="No state panels available"
            description="This algorithm step did not emit panel data."
            className="h-auto"
            compact
          />
        )
      )}
      {showMetrics && (
        <MetricsSection metrics={step.metrics} phase={step.phase} description={step.description} />
      )}
    </div>
  );
}
