import * as Tooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';
import StatusBadge from '@/components/shared/StatusBadge';

interface ComplexityBadgeProps {
  label: string;
  value: string;
  tooltip?: string;
}

export default function ComplexityBadge({ label, value, tooltip }: ComplexityBadgeProps) {
  const badge = (
    <StatusBadge
      className={cn('font-mono text-xs', tooltip && 'cursor-help')}
      size="md"
    >
      <span className="text-[var(--text-2)]">{label}:</span>
      <span className="text-[var(--accent)]">{value}</span>
    </StatusBadge>
  );

  if (!tooltip) return badge;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{badge}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 px-3 py-1.5 text-xs rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] shadow-lg max-w-xs"
            sideOffset={4}
          >
            {tooltip}
            <Tooltip.Arrow className="fill-[var(--surface-2)]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
