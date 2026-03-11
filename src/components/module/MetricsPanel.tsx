import { cn } from '@/lib/cn';
import CollapsibleSection from '@/components/shared/CollapsibleSection';
import EmptyState from '@/components/shared/EmptyState';
import StatTile from '@/components/shared/StatTile';
import type { AlgorithmCategory, StepMetrics } from '@/types';

interface MetricsPanelProps {
  metrics: StepMetrics | null;
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

function fmtNum(v: number | undefined): string {
  if (v === undefined || v === null) return '–';
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
            {algorithmCategory === 'local-search' ? (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <StatTile label="Iteration" value={fmtNum(metrics.iteration ?? metrics.currentDepth)} valueColor="text-[var(--accent)]" />
                <StatTile label="Candidates" value={fmtNum(metrics.candidateCount ?? metrics.frontierSize)} valueColor="text-[var(--accent)]" />
                <StatTile label="Objective" value={fmtNum(metrics.objectiveValue ?? metrics.conflictCount ?? metrics.pathCost)} valueColor="text-[var(--warning)]" />
                <StatTile label="Best" value={fmtNum(metrics.bestObjectiveValue ?? metrics.bestConflictCount ?? metrics.bestScore)} valueColor="text-[var(--success)]" />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <StatTile label="Evaluated" value={fmtNum(metrics.neighborsEvaluated ?? metrics.nodesExpanded)} valueColor="text-[var(--text)]" />
                <StatTile label="Restarts" value={fmtNum(metrics.restartCount)} valueColor="text-[var(--text)]" />
                <StatTile label="Plateau" value={fmtNum(metrics.plateauLength)} valueColor="text-[var(--text-2)]" />
                <StatTile
                  label="Temp"
                  value={fmtNum(metrics.temperature)}
                  valueColor={metrics.temperature !== undefined ? 'text-[var(--purple)]' : 'text-[var(--text-2)]'}
                />
              </div>

              {(metrics.generation !== undefined || metrics.populationSize !== undefined || metrics.beamWidth !== undefined || metrics.tabuSize !== undefined) && (
                <div className="grid grid-cols-2 gap-1.5">
                  <StatTile label="Generation" value={fmtNum(metrics.generation)} valueColor="text-[var(--text)]" />
                  <StatTile label="Population" value={fmtNum(metrics.populationSize)} valueColor="text-[var(--text)]" />
                  <StatTile label="Beam" value={fmtNum(metrics.beamWidth)} valueColor="text-[var(--text-2)]" />
                  <StatTile label="Tabu" value={fmtNum(metrics.tabuSize)} valueColor="text-[var(--text-2)]" />
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <StatTile label="Expanded" value={fmtNum(metrics.nodesExpanded)} valueColor="text-[var(--accent)]" />
              <StatTile label="Frontier" value={fmtNum(metrics.frontierSize)} valueColor="text-[var(--accent)]" />
              <StatTile
                label="Path Cost"
                value={fmtNum(metrics.pathCost)}
                valueColor={metrics.pathCost !== undefined && isFinite(metrics.pathCost) ? 'text-[#3FB950]' : 'text-[var(--text-2)]'}
              />
              <StatTile label="Depth" value={fmtNum(metrics.currentDepth)} valueColor="text-[var(--text)]" />
            </div>
          )}

          {/* Cost breakdown */}
          {(metrics.gCost !== undefined || metrics.hCost !== undefined || metrics.fCost !== undefined) && (
            <div className="grid grid-cols-3 gap-1.5">
              {metrics.gCost !== undefined && (
                <StatTile label="g(n)" value={fmtNum(metrics.gCost)} valueColor="text-[var(--warning)]" />
              )}
              {metrics.hCost !== undefined && (
                <StatTile label="h(n)" value={fmtNum(metrics.hCost)} valueColor="text-[var(--purple)]" />
              )}
              {metrics.fCost !== undefined && (
                <StatTile label="f(n)" value={fmtNum(metrics.fCost)} valueColor="text-[var(--accent)]" />
              )}
            </div>
          )}

          {/* Memory */}
          {metrics.memoryUsed !== undefined && (
            <StatTile label="Memory (nodes)" value={fmtNum(metrics.memoryUsed)} valueColor="text-[var(--text-2)]" />
          )}

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
