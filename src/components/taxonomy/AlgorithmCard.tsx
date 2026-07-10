import { useNavigate } from 'react-router-dom';
import type { AlgorithmMeta } from '@/types';
import { ALGORITHM_TO_PROBLEM_CATEGORY } from '@/types/problem';
import AlgorithmBadge from '@/components/shared/AlgorithmBadge';
import ComplexityBadge from '@/components/shared/ComplexityBadge';
import GuaranteeBadge from '@/components/shared/GuaranteeBadge';
import StatusBadge from '@/components/shared/StatusBadge';
import { Gamepad2 } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';
import { buildRoute } from '@/lib/buildRoute';

interface AlgorithmCardProps {
  meta: AlgorithmMeta;
}

export default function AlgorithmCard({ meta }: AlgorithmCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(buildRoute(meta, ALGORITHM_TO_PROBLEM_CATEGORY[meta.category]))}
      className={cn(
        'ui-panel text-left w-full rounded-xl p-4',
        'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 transition-colors group',
        'focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors leading-snug">
          {meta.name}
        </h3>
        <div className="flex gap-1 flex-wrap justify-end shrink-0">
          {meta.complete !== undefined && <GuaranteeBadge kind="complete" value={meta.complete} />}
          {meta.optimal !== undefined && <GuaranteeBadge kind="optimal" value={meta.optimal} />}
        </div>
      </div>

      {/* Category badge */}
      <div className="mb-2">
        <AlgorithmBadge category={meta.category} size="sm" />
      </div>

      {/* Description */}
      {meta.description && (
        <p className="text-xs text-[var(--text-2)] mb-3 line-clamp-2">{meta.description}</p>
      )}

      {/* Complexity */}
      <div className="flex gap-1.5 flex-wrap">
        {meta.timeComplexity && (
          <ComplexityBadge label="Time" value={meta.timeComplexity} />
        )}
        {meta.spaceComplexity && (
          <ComplexityBadge label="Space" value={meta.spaceComplexity} />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        {meta.bookChapter ? (
          <span className="min-w-0 truncate text-[10px] text-[var(--text-3)] font-mono">
            {meta.bookChapter}
          </span>
        ) : (
          <span />
        )}
        <StatusBadge
          tone="neutral"
          className="shrink-0 border-[var(--border)] bg-[var(--surface-2)]/78 text-[var(--text-3)] backdrop-blur-md group-hover:text-[var(--text-2)]"
          title="Algorithm cards open the default playground for this algorithm."
        >
          <Gamepad2 size={10} />
          Default playground
        </StatusBadge>
      </div>
    </button>
  );
}
