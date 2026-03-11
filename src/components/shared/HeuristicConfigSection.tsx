import type { ReactNode } from 'react';
import Select from '@/components/shared/Select';

interface HeuristicOption {
  value: string;
  label: string;
}

interface HeuristicConfigSectionProps {
  heuristicId: string;
  onHeuristicIdChange: (value: string) => void;
  heuristicOptions: HeuristicOption[];
  description: string;
  heuristicScale: number;
  onHeuristicScaleChange: (value: number) => void;
  beforeSelect?: ReactNode;
  afterSelect?: ReactNode;
  afterScale?: ReactNode;
  footer?: ReactNode;
}

export default function HeuristicConfigSection({
  heuristicId,
  onHeuristicIdChange,
  heuristicOptions,
  description,
  heuristicScale,
  onHeuristicScaleChange,
  beforeSelect,
  afterSelect,
  afterScale,
  footer,
}: HeuristicConfigSectionProps) {
  const showScale = heuristicId !== 'manual-node' && heuristicId !== 'zero';

  return (
    <div className="space-y-4">
      {beforeSelect}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Heuristic Function</p>
        <Select
          value={heuristicId}
          onValueChange={onHeuristicIdChange}
          options={heuristicOptions}
        />
        <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-3)]">{description}</p>
      </div>
      {afterSelect}
      {showScale ? (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-3)]">Scale (w)</p>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={heuristicScale}
            onChange={(e) => onHeuristicScaleChange(Math.max(0.1, Number(e.target.value) || 0.1))}
            className="ui-input w-full px-2 py-1.5 font-mono"
          />
        </div>
      ) : null}
      {afterScale}
      {footer}
    </div>
  );
}