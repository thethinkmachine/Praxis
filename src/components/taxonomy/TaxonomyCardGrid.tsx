import type { AlgorithmMeta, AlgorithmCategory } from '@/types';
import CategorySection from './CategorySection';
import { CATEGORY_ORDER } from '@/lib/constants';

interface TaxonomyCardGridProps {
  algorithms: AlgorithmMeta[];
}

export default function TaxonomyCardGrid({ algorithms }: TaxonomyCardGridProps) {
  const byCategory = new Map<AlgorithmCategory, AlgorithmMeta[]>();
  for (const cat of CATEGORY_ORDER) {
    byCategory.set(cat, []);
  }
  for (const algo of algorithms) {
    if (byCategory.has(algo.category)) {
      byCategory.get(algo.category)!.push(algo);
    }
  }

  return (
    <div className="p-3 sm:p-6 overflow-y-auto h-full">
      {CATEGORY_ORDER.map((cat) => (
        <CategorySection
          key={cat}
          category={cat}
          algorithms={byCategory.get(cat) ?? []}
        />
      ))}
    </div>
  );
}
