import type { AlgorithmMeta, AlgorithmCategory } from '@/types';
import AlgorithmCard from './AlgorithmCard';
import {
  UninformedSearchIcon, InformedSearchIcon, GamePlayingIcon,
  LocalSearchIcon, PlanningIcon, ConstraintSatisfactionIcon,
} from '@/components/shared/CategoryIcons';

const CATEGORY_LABELS: Record<AlgorithmCategory, string> = {
  'uninformed-search': 'Uninformed Search',
  'informed-search': 'Informed Search',
  'game-playing': 'Game Playing',
  'local-search': 'Local Search',
  'planning': 'Planning',
  'constraint-satisfaction': 'Constraint Satisfaction',
};

const CATEGORY_ICONS: Record<AlgorithmCategory, typeof UninformedSearchIcon> = {
  'uninformed-search': UninformedSearchIcon,
  'informed-search': InformedSearchIcon,
  'game-playing': GamePlayingIcon,
  'local-search': LocalSearchIcon,
  'planning': PlanningIcon,
  'constraint-satisfaction': ConstraintSatisfactionIcon,
};

interface CategorySectionProps {
  category: AlgorithmCategory;
  algorithms: AlgorithmMeta[];
}

export default function CategorySection({ category, algorithms }: CategorySectionProps) {
  if (algorithms.length === 0) return null;

  const CategoryIcon = CATEGORY_ICONS[category];

  return (
    <section id={`category-${category}`} className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] p-1 text-[var(--text-3)]">
          <CategoryIcon size={14} />
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
