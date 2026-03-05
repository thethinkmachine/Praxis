import { cn } from '@/lib/cn';

interface StepScrubberProps {
  current: number;
  total: number;
  onChange: (index: number) => void;
  disabled?: boolean;
}

export default function StepScrubber({
  current,
  total,
  onChange,
  disabled = false,
}: StepScrubberProps) {
  const max = Math.max(0, total - 1);
  const pct = max > 0 ? (current / max) * 100 : 0;
  const isDisabled = disabled || total === 0;

  return (
    <div className={cn('step-scrubber relative w-full h-5 flex items-center group', isDisabled && 'opacity-40')}>
      {/* Track background */}
      <div className="absolute inset-x-0 h-[5px] rounded-full bg-[var(--border)] pointer-events-none" />

      {/* Fill track */}
      <div
        className="absolute left-0 h-[5px] rounded-full pointer-events-none transition-[width] duration-75"
        style={{
          width: isDisabled || total === 0 ? '0%' : `${pct}%`,
          background: 'linear-gradient(90deg, #3B82F6 0%, #58A6FF 55%, #79C0FF 100%)',
          boxShadow: pct > 0 ? '0 0 8px rgba(88,166,255,0.45)' : 'none',
        }}
      />

      {/* Custom thumb */}
      {!isDisabled && (
        <div
          className="absolute w-[15px] h-[15px] rounded-full pointer-events-none transition-transform duration-100 group-hover:scale-110"
          style={{
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #E8F4FF 100%)',
            boxShadow: '0 0 0 2.5px #58A6FF, 0 2px 6px rgba(0,0,0,0.25)',
          }}
        />
      )}

      {/* Native range input — invisible but handles all interaction */}
      <input
        type="range"
        min={0}
        max={max}
        value={current}
        disabled={isDisabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Step scrubber"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}
