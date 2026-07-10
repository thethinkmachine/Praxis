import { useNavigate } from 'react-router-dom';
import type { AlgorithmMeta } from '@/types';
import { ALGORITHM_TO_PROBLEM_CATEGORY } from '@/types/problem';
import ComplexityBadge from '@/components/shared/ComplexityBadge';
import GuaranteeBadge from '@/components/shared/GuaranteeBadge';
import { Gamepad2 } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';
import { buildRoute } from '@/lib/buildRoute';

interface AlgorithmCardProps {
  meta: AlgorithmMeta;
}

export default function AlgorithmCard({ meta }: AlgorithmCardProps) {
  const navigate = useNavigate();
  const hasGuarantees = meta.complete !== undefined || meta.optimal !== undefined;

  return (
    <button
      onClick={() => navigate(buildRoute(meta, ALGORITHM_TO_PROBLEM_CATEGORY[meta.category]))}
      className={cn(
        'ui-panel text-left w-full rounded-xl p-4',
        'hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]/50 transition-colors group',
        'focus-visible:outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20',
      )}
    >
      {/* Title always gets the full row to itself — guarantee badges live on
          their own line below so they never force a wrap. Category is already
          conveyed by the enclosing CategorySection, so it isn't repeated here. */}
      <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)] transition-colors leading-snug mb-1.5">
        {meta.name}
      </h3>

      {hasGuarantees && (
        <div className="flex gap-1 flex-wrap mb-2">
          {meta.complete !== undefined && <GuaranteeBadge kind="complete" value={meta.complete} />}
          {meta.optimal !== undefined && <GuaranteeBadge kind="optimal" value={meta.optimal} />}
        </div>
      )}

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
        <span
          className="shrink-0 flex items-center gap-1 text-[10px] text-[var(--text-3)] transition-colors group-hover:text-[var(--accent)]"
          title="Algorithm cards open the default playground for this algorithm."
        >
          <Gamepad2 size={10} />
          Default playground
        </span>
      </div>
    </button>
  );
}
