import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

interface BrandDisplayProps {
  className?: string;
  /** Compact mode: wordmark only, no tagline/authorship — used in tight spaces (e.g. the algorithm title strip). */
  hideAuthorship?: boolean;
}

export default function BrandDisplay({ className, hideAuthorship = false }: BrandDisplayProps) {
  return (
    <div className={cn('group flex items-center gap-2 select-none cursor-default', className)}>
      <Link to="/" className="flex items-center focus-visible:outline-none" aria-label="Praxis home">
        <span className="font-mono text-[13px] font-bold tracking-tight text-[var(--text)] transition-[letter-spacing] duration-200 ease-out group-hover:tracking-[0.03em]">
          Praxis
        </span>
      </Link>

      {!hideAuthorship && (
        <>
          <span className="h-3.5 w-px shrink-0 bg-[var(--border-strong)]" />

          {/* Tagline and authorship occupy the same grid cell and cross-fade on
              hover, so the container sizes to the wider of the two and there's
              no layout shift when swapping between them. */}
          <div className="grid">
            <span
              className={cn(
                'col-start-1 row-start-1 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-3)]',
                'transition-opacity duration-200 ease-out group-hover:opacity-0',
              )}
            >
              AI Algorithm Library &amp; Playground
            </span>
            <a
              href="https://github.com/thethinkmachine"
              target="_blank"
              rel="noopener noreferrer"
              title="View author's GitHub profile"
              className={cn(
                'col-start-1 row-start-1 whitespace-nowrap self-center text-[11.5px] text-[var(--text-3)]',
                'pointer-events-none opacity-0 transition-opacity duration-200 ease-out delay-100',
                'group-hover:pointer-events-auto group-hover:opacity-100',
                'hover:text-[var(--accent)] hover:underline focus-visible:text-[var(--accent)] focus-visible:outline-none',
              )}
            >
              by <span className="font-medium text-[var(--text-2)]">Shreyan Chaubey</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
