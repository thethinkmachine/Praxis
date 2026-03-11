import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { tokenise } from '@/lib/pseudocode-tokeniser';

interface PseudocodePanelProps {
  lines: string[];
  activeLine: number;
  algorithmName?: string;
}

export default function PseudocodePanel({
  lines,
  activeLine,
  algorithmName,
}: PseudocodePanelProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeLine]);

  if (lines.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--surface)]">
        <span className="text-sm text-[var(--text-3)]">No pseudocode available</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--surface)] overflow-hidden">
      {/* Lines */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {lines.map((line, i) => {
          const isActive = i === activeLine;
          const isPast   = i < activeLine;
          const tokens   = tokenise(line);
          return (
            <div
              key={i}
              ref={isActive ? activeRef : undefined}
              className={cn(
                'flex items-start gap-3 px-3 py-0.5 border-l-2 transition-colors',
                isActive
                  ? 'bg-[var(--color-current)]/10 border-[var(--color-current)]'
                  : isPast
                    ? 'border-transparent opacity-40'
                    : 'border-transparent hover:bg-[var(--surface-2)]/40',
              )}
            >
              <span
                className={cn(
                  'w-5 text-right shrink-0 select-none text-[10px]',
                  isActive ? 'text-[var(--color-current)]' : 'text-[var(--text-3)]',
                )}
              >
                {i + 1}
              </span>
              <pre className="whitespace-pre-wrap break-words">
                {tokens.map((tok, ti) =>
                  tok.cls ? (
                    <span key={ti} className={tok.cls}>{tok.text}</span>
                  ) : (
                    <span
                      key={ti}
                      className={isActive ? 'text-[var(--text)]' : 'text-[var(--text-2)]'}
                    >
                      {tok.text}
                    </span>
                  ),
                )}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
