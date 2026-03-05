import { cn } from '@/lib/cn';
import type { StepMetrics } from '@/types';

interface MetricsPanelProps {
  metrics: StepMetrics | null;
  phase?: string;
  description?: string;
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
// Mirrors the .stat / .stat-val / .stat-lbl pattern from the HTML reference.
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
          // large size when value is a short number, smaller for long strings
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

export default function MetricsPanel({ metrics, phase, description }: MetricsPanelProps) {
  const phaseClass =
    phase ? (PHASE_COLORS[phase.toLowerCase()] ?? 'bg-[var(--surface-2)] text-[var(--text-2)]') : null;

  return (
    <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
      {metrics ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {/* Phase indicator inside content */}
          {phase && phaseClass && (
            <div className="flex justify-end mb-1">
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', phaseClass)}>
                {phase}
              </span>
            </div>
          )}

          {/* Primary search metrics */}
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
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-[var(--text-3)]">No metrics yet</span>
        </div>
      )}
    </div>
  );
}
