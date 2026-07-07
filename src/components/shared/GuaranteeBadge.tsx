import * as Tooltip from '@radix-ui/react-tooltip';
import StatusBadge from '@/components/shared/StatusBadge';

interface GuaranteeBadgeProps {
  kind: 'complete' | 'optimal';
  /** meta.complete / meta.optimal — a plain boolean, or a string carrying the
   *  algorithm-specific caveat (e.g. "unit-cost only"). */
  value: boolean | string;
}

function explain(kind: GuaranteeBadgeProps['kind'], value: boolean | string): string {
  if (typeof value === 'string') return value;

  if (kind === 'complete') {
    return value
      ? 'Guaranteed to find a solution whenever one exists.'
      : 'Not guaranteed to find a solution, even when one exists.';
  }
  return value
    ? 'Guaranteed to find the optimal (lowest-cost/best) solution.'
    : 'Does not guarantee the optimal solution — it may trade correctness for speed or memory.';
}

export default function GuaranteeBadge({ kind, value }: GuaranteeBadgeProps) {
  const positive = Boolean(value);
  const label = kind === 'complete'
    ? (positive ? '✓ Complete' : '✗ Incomplete')
    : (positive ? '★ Optimal' : '○ Suboptimal');
  const tone = kind === 'complete'
    ? (positive ? 'success' : 'danger')
    : (positive ? 'success' : 'warning');

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <StatusBadge tone={tone} className="cursor-help">
            {label}
          </StatusBadge>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 px-3 py-1.5 text-xs rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] shadow-lg max-w-xs"
            sideOffset={4}
          >
            {explain(kind, value)}
            <Tooltip.Arrow className="fill-[var(--surface-2)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
