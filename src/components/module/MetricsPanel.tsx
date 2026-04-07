import { cn } from '@/lib/cn';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import EmptyState from '@/components/shared/EmptyState';
import StatTile from '@/components/shared/StatTile';
import type { AlgorithmCategory, StepMetrics, MetricTile } from '@/types';

interface MetricsPanelProps {
  metrics: StepMetrics | MetricTile[] | null;
  phase?: string;
  description?: string;
  algorithmCategory?: AlgorithmCategory;
}

const PHASE_COLORS: Record<string, string> = {
  found:     'ui-pill ui-pill-success',
  goal:      'ui-pill ui-pill-success',
  success:   'ui-pill ui-pill-success',
  failed:    'ui-pill ui-pill-danger',
  fail:      'ui-pill ui-pill-danger',
  expanding: 'ui-pill ui-pill-warning',
  visiting:  'ui-pill ui-pill-warning',
  start:     'ui-pill ui-pill-purple',
  exploring: 'ui-pill ui-pill-accent',
};

function fmtNum(v: number | string | undefined): string {
  if (v === undefined || v === null) return '–';
  if (typeof v === 'string') return v;
  if (!isFinite(v)) return '∞';
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(3);
}

// Large-number card: value first (big), label below (small caps).
export default function MetricsPanel({ metrics, phase, description, algorithmCategory }: MetricsPanelProps) {
  const phaseClass =
    phase ? (PHASE_COLORS[phase.toLowerCase()] ?? 'bg-[var(--surface-2)] text-[var(--text-2)]') : null;

  return (
    <CollapsibleSection
      title="Metrics"
      headerClassName="sticky top-0 z-10"
    >
      <div className="space-y-2">
        {phase && phaseClass && (
          <div className="flex items-center gap-1.5">
            <span className={cn('text-[9px] px-1.5 py-0.5 font-medium rounded-full', phaseClass)}>
              {phase}
            </span>
          </div>
        )}
        {metrics ? (
          <>
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
              ) : Object.entries(metrics).filter(([_, v]) => v !== undefined).map(([key, val], i) => (
                <StatTile key={i} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} value={fmtNum(val)} valueColor="text-[var(--text)]" />
              ))}
            </div>

          {/* Description */}
          {description && (
            <p className="text-[10px] text-[var(--text-2)] border-t border-[var(--border)] pt-2 mt-1 leading-relaxed font-mono">
              {description}
            </p>
          )}
          </>
        ) : (
          <EmptyState title="No metrics yet" compact className="min-h-[80px]" />
        )}
      </div>
    </CollapsibleSection>
  );
}
