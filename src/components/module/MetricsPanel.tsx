import { useState } from 'react';
import { cn } from '@/lib/cn';
import { ChevronDown, ChevronRight } from '@/components/shared/Icons';
import type { AlgorithmCategory, StepMetrics } from '@/types';

interface MetricsPanelProps {
  metrics: StepMetrics | null;
  phase?: string;
  description?: string;
  algorithmCategory?: AlgorithmCategory;
}

const PHASE_COLORS: Record<string, string> = {
  found:     'bg-[#3FB950]/15 text-[#3FB950]',
  goal:      'bg-[#3FB950]/15 text-[#3FB950]',
  success:   'bg-[#3FB950]/15 text-[#3FB950]',
  failed:    'bg-[#FF7B72]/15 text-[#FF7B72]',
  fail:      'bg-[#FF7B72]/15 text-[#FF7B72]',
  expanding: 'bg-[#F0883E]/15 text-[#F0883E]',
  visiting:  'bg-[#F0883E]/15 text-[#F0883E]',
  start:     'bg-[#D2A8FF]/15 text-[#D2A8FF]',
  exploring: 'bg-[#58A6FF]/15 text-[#58A6FF]',
};

function fmtNum(v: number | undefined): string {
  if (v === undefined || v === null) return '–';
  if (!isFinite(v)) return '∞';
  if (Number.isInteger(v)) return v.toString();
  return v.toFixed(3);
}

// Large-number card: value first (big), label below (small caps).
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}

function StatCard({ label, value, valueColor }: StatCardProps) {
  return (
    <div className="flex flex-col bg-[var(--surface-2)] rounded p-2 border border-[var(--border)]">
      <span
        className={cn(
          'font-mono font-light leading-none tracking-tight',
          typeof value === 'string' && value.length > 6 ? 'text-base' : 'text-2xl',
          valueColor ?? 'text-[#58A6FF]',
        )}
      >
        {value}
      </span>
      <span className="text-[8px] font-semibold uppercase tracking-wider text-[var(--text-3)] mt-1">
        {label}
      </span>
    </div>
  );
}

export default function MetricsPanel({ metrics, phase, description, algorithmCategory }: MetricsPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const phaseClass =
    phase ? (PHASE_COLORS[phase.toLowerCase()] ?? 'bg-[var(--surface-2)] text-[var(--text-2)]') : null;

  return (
    <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
      <div 
        className="px-3 py-1 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center gap-2 select-none cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-[var(--text-3)]">
          {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
        <span className="text-[10px] font-semibold text-[var(--text-2)] uppercase tracking-wider flex-1">
          Metrics
        </span>
        {phase && phaseClass && (
          <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', phaseClass)}>
            {phase}
          </span>
        )}
      </div>

      {isOpen && (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {metrics ? (
            <>

          {algorithmCategory === 'local-search' ? (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <StatCard label="Iteration" value={fmtNum(metrics.iteration ?? metrics.currentDepth)} valueColor="text-[#58A6FF]" />
                <StatCard label="Candidates" value={fmtNum(metrics.candidateCount ?? metrics.frontierSize)} valueColor="text-[#58A6FF]" />
                <StatCard label="Objective" value={fmtNum(metrics.objectiveValue ?? metrics.conflictCount ?? metrics.pathCost)} valueColor="text-[#F0883E]" />
                <StatCard label="Best" value={fmtNum(metrics.bestObjectiveValue ?? metrics.bestConflictCount ?? metrics.bestScore)} valueColor="text-[#3FB950]" />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <StatCard label="Evaluated" value={fmtNum(metrics.neighborsEvaluated ?? metrics.nodesExpanded)} valueColor="text-[var(--text)]" />
                <StatCard label="Restarts" value={fmtNum(metrics.restartCount)} valueColor="text-[var(--text)]" />
                <StatCard label="Plateau" value={fmtNum(metrics.plateauLength)} valueColor="text-[var(--text-2)]" />
                <StatCard
                  label="Temp"
                  value={fmtNum(metrics.temperature)}
                  valueColor={metrics.temperature !== undefined ? 'text-[#D2A8FF]' : 'text-[var(--text-2)]'}
                />
              </div>

              {(metrics.generation !== undefined || metrics.populationSize !== undefined || metrics.beamWidth !== undefined || metrics.tabuSize !== undefined) && (
                <div className="grid grid-cols-2 gap-1.5">
                  <StatCard label="Generation" value={fmtNum(metrics.generation)} valueColor="text-[var(--text)]" />
                  <StatCard label="Population" value={fmtNum(metrics.populationSize)} valueColor="text-[var(--text)]" />
                  <StatCard label="Beam" value={fmtNum(metrics.beamWidth)} valueColor="text-[var(--text-2)]" />
                  <StatCard label="Tabu" value={fmtNum(metrics.tabuSize)} valueColor="text-[var(--text-2)]" />
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              <StatCard label="Expanded" value={fmtNum(metrics.nodesExpanded)} valueColor="text-[#58A6FF]" />
              <StatCard label="Frontier" value={fmtNum(metrics.frontierSize)} valueColor="text-[#58A6FF]" />
              <StatCard
                label="Path Cost"
                value={fmtNum(metrics.pathCost)}
                valueColor={metrics.pathCost !== undefined && isFinite(metrics.pathCost) ? 'text-[#3FB950]' : 'text-[var(--text-2)]'}
              />
              <StatCard label="Depth" value={fmtNum(metrics.currentDepth)} valueColor="text-[var(--text)]" />
            </div>
          )}

          {/* Cost breakdown */}
          {(metrics.gCost !== undefined || metrics.hCost !== undefined || metrics.fCost !== undefined) && (
            <div className="grid grid-cols-3 gap-1.5">
              {metrics.gCost !== undefined && (
                <StatCard label="g(n)" value={fmtNum(metrics.gCost)} valueColor="text-[#F0883E]" />
              )}
              {metrics.hCost !== undefined && (
                <StatCard label="h(n)" value={fmtNum(metrics.hCost)} valueColor="text-[#D2A8FF]" />
              )}
              {metrics.fCost !== undefined && (
                <StatCard label="f(n)" value={fmtNum(metrics.fCost)} valueColor="text-[#58A6FF]" />
              )}
            </div>
          )}

          {/* Memory */}
          {metrics.memoryUsed !== undefined && (
            <StatCard label="Memory (nodes)" value={fmtNum(metrics.memoryUsed)} valueColor="text-[var(--text-2)]" />
          )}

          {/* Description */}
          {description && (
            <p className="text-[10px] text-[var(--text-2)] border-t border-[var(--border)] pt-2 mt-1 leading-relaxed font-mono">
              {description}
            </p>
          )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm text-[var(--text-3)]">No metrics yet</span>
          </div>
        )}
      </div>
    )}
  </div>
);
}
