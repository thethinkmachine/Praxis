import { cn } from '@/lib/cn';

export const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

interface SpeedSliderProps {
  value: number;
  onChange: (speed: number) => void;
}

function formatSpeed(s: number) {
  return s < 1 ? `${s}×` : `${s}×`;
}

export default function SpeedSlider({ value, onChange }: SpeedSliderProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-3)]">
        Speed
      </span>
      {/* Segmented control container */}
      <div className="flex items-stretch rounded-md overflow-hidden border border-[var(--border)] bg-[var(--bg)]">
        {SPEEDS.map((s, i) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn(
              'relative text-[10px] font-medium tabular-nums px-2 py-1 transition-all duration-100 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]',
              i > 0 && 'border-l border-[var(--border)]',
              value === s
                ? 'bg-[var(--accent)] text-[var(--bg)] shadow-inner'
                : 'text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
            )}
          >
            {formatSpeed(s)}
          </button>
        ))}
      </div>
    </div>
  );
}
