import type { AlgorithmMeta, AlgorithmCategory } from '@/types';
import AlgorithmCard from './AlgorithmCard';

const CATEGORY_LABELS: Record<AlgorithmCategory, string> = {
  'uninformed-search': 'Uninformed Search',
  'informed-search': 'Informed Search',
  'game-playing': 'Game Playing',
  'local-search': 'Local Search',
};

const CATEGORY_ICONS: Record<AlgorithmCategory, string> = {
  'uninformed-search': 'SEARCH',
  'informed-search': 'H*',
  'game-playing': 'MINMAX',
  'local-search': 'LOCAL',
};

interface CategorySectionProps {
  category: AlgorithmCategory;
  algorithms: AlgorithmMeta[];
}

export default function CategorySection({ category, algorithms }: CategorySectionProps) {
  if (algorithms.length === 0) return null;

  return (
    <section id={`category-${category}`} className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-3)] font-mono">
          {CATEGORY_ICONS[category]}
        </span>
        <h2 className="text-base font-semibold text-[var(--text)]">{CATEGORY_LABELS[category]}</h2>
        <span className="text-xs text-[var(--text-3)] ml-1 font-mono">
          ({algorithms.length} algorithm{algorithms.length !== 1 ? 's' : ''})
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {algorithms.map((algo) => (
          <AlgorithmCard key={algo.id} meta={algo} />
        ))}
      </div>
    </section>
  );
}
