import { useNavigate } from 'react-router-dom';
import type { AlgorithmMeta } from '@/types';
import AlgorithmBadge from '@/components/shared/AlgorithmBadge';
import ComplexityBadge from '@/components/shared/ComplexityBadge';
import { cn } from '@/lib/cn';

interface AlgorithmCardProps {
  meta: AlgorithmMeta;
}

function buildRoute(meta: AlgorithmMeta): string {
  return `/search/uninformed-search/${meta.id}`;
}

export default function AlgorithmCard({ meta }: AlgorithmCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(buildRoute(meta))}
      className={cn(
        'text-left w-full rounded-lg p-4 border border-[var(--border)] bg-[var(--surface)]',
        'hover:border-[#58A6FF] hover:bg-[#58A6FF]/5 transition-colors group'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[#58A6FF] transition-colors leading-snug">
          {meta.name}
        </h3>
        <div className="flex gap-1 flex-wrap justify-end shrink-0">
          {meta.complete !== undefined && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium',
                meta.complete
                  ? 'bg-[#3FB950]/15 text-[#3FB950]'
                  : 'bg-[#FF7B72]/15 text-[#FF7B72]'
              )}
            >
              {meta.complete ? '✓ Complete' : '✗'}
            </span>
          )}
          {meta.optimal !== undefined && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded font-medium',
                meta.optimal
                  ? 'bg-[#3FB950]/15 text-[#3FB950]'
                  : 'bg-[#F0883E]/15 text-[#F0883E]'
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
        <div className="mt-2 text-[10px] text-[var(--text-3)]">
          AIMA {meta.bookChapter}
        </div>
      )}
    </button>
  );
}
