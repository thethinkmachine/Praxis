import { useNavigate } from 'react-router-dom';
import type { AlgorithmMeta } from '@/types';
import { ALGORITHM_TO_PROBLEM_CATEGORY } from '@/types/problem';
import AlgorithmBadge from '@/components/shared/AlgorithmBadge';
import ComplexityBadge from '@/components/shared/ComplexityBadge';
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
        'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 transition-colors group'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors leading-snug">
          {meta.name}
        </h3>
        <div className="flex gap-1 flex-wrap justify-end shrink-0">
          {meta.complete !== undefined && (
            <span
              className={cn(
                'ui-pill text-[10px] px-1.5 py-0.5 font-medium',
                meta.complete
                  ? 'ui-pill-success'
                  : 'ui-pill-danger'
              )}
            >
              {meta.complete ? '✓ Complete' : '✗'}
            </span>
          )}
          {meta.optimal !== undefined && (
            <span
              className={cn(
                'ui-pill text-[10px] px-1.5 py-0.5 font-medium',
                meta.optimal
                  ? 'ui-pill-success'
                  : 'ui-pill-warning'
              )}
            >
              {meta.optimal ? '★ Optimal' : '○'}
            </span>
          )}
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

      {/* AIMA reference */}
      {meta.bookChapter && (
        <div className="mt-2 text-[10px] text-[var(--text-3)] font-mono">
          AIMA {meta.bookChapter}
        </div>
      )}
    </button>
  );
}
