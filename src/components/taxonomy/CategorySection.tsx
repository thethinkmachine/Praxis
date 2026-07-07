import { useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import type { AlgorithmMeta, AlgorithmCategory } from '@/types';
import AlgorithmCard from './AlgorithmCard';
import {
  UninformedSearchIcon, InformedSearchIcon, GamePlayingIcon,
  LocalSearchIcon, PlanningIcon, ConstraintSatisfactionIcon,
} from '@/components/shared/CategoryIcons';
import { ArrowUpDown } from '@/components/shared/Icons';
import { cn } from '@/lib/cn';
import { compareLabels } from '@/lib/natural-sort';
import { complexityRank } from '@/lib/complexity-rank';

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

type SortKey = 'default' | 'name' | 'time' | 'space' | 'complete' | 'optimal';
type TriState = 'all' | 'yes' | 'no';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'default', label: 'Default order' },
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'time', label: 'Time complexity (fastest first)' },
  { value: 'space', label: 'Space complexity (lowest memory first)' },
  { value: 'complete', label: 'Completeness (complete first)' },
  { value: 'optimal', label: 'Optimality (optimal first)' },
];

function sortAlgorithms(list: AlgorithmMeta[], key: SortKey): AlgorithmMeta[] {
  if (key === 'default') return list;
  const sorted = [...list];
  switch (key) {
    case 'name':
      sorted.sort((a, b) => compareLabels(a.name, b.name));
      break;
    case 'time':
      sorted.sort((a, b) => complexityRank(a.timeComplexity) - complexityRank(b.timeComplexity) || compareLabels(a.name, b.name));
      break;
    case 'space':
      sorted.sort((a, b) => complexityRank(a.spaceComplexity) - complexityRank(b.spaceComplexity) || compareLabels(a.name, b.name));
      break;
    case 'complete':
      sorted.sort((a, b) => Number(!a.complete) - Number(!b.complete) || compareLabels(a.name, b.name));
      break;
    case 'optimal':
      sorted.sort((a, b) => Number(!a.optimal) - Number(!b.optimal) || compareLabels(a.name, b.name));
      break;
  }
  return sorted;
}

function passesFilter(value: boolean | string, filter: TriState): boolean {
  if (filter === 'all') return true;
  return filter === 'yes' ? Boolean(value) : !value;
}

function TriToggle({ value, onChange, yesLabel, noLabel }: {
  value: TriState;
  onChange: (next: TriState) => void;
  yesLabel: string;
  noLabel: string;
}) {
  const options: Array<{ value: TriState; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'yes', label: yesLabel },
    { value: 'no', label: noLabel },
  ];
  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 truncate rounded px-1.5 py-1 text-[10px] font-medium transition-colors',
            value === opt.value
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface CategorySectionProps {
  category: AlgorithmCategory;
  algorithms: AlgorithmMeta[];
}

export default function CategorySection({ category, algorithms }: CategorySectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [completeFilter, setCompleteFilter] = useState<TriState>('all');
  const [optimalFilter, setOptimalFilter] = useState<TriState>('all');

  const visible = useMemo(() => {
    const filtered = algorithms.filter(
      (a) => passesFilter(a.complete, completeFilter) && passesFilter(a.optimal, optimalFilter),
    );
    return sortAlgorithms(filtered, sortKey);
  }, [algorithms, sortKey, completeFilter, optimalFilter]);

  if (algorithms.length === 0) return null;

  const CategoryIcon = CATEGORY_ICONS[category];
  const activeCount = (sortKey !== 'default' ? 1 : 0) + (completeFilter !== 'all' ? 1 : 0) + (optimalFilter !== 'all' ? 1 : 0);

  const reset = () => {
    setSortKey('default');
    setCompleteFilter('all');
    setOptimalFilter('all');
  };

  return (
    <section id={`category-${category}`} className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] p-1 text-[var(--text-3)]">
          <CategoryIcon size={14} />
        </span>
        <h2 className="text-base font-semibold text-[var(--text)]">{CATEGORY_LABELS[category]}</h2>
        <span className="text-xs text-[var(--text-3)] ml-1 font-mono">
          ({visible.length}{visible.length !== algorithms.length ? ` of ${algorithms.length}` : ''} algorithm{algorithms.length !== 1 ? 's' : ''})
        </span>

        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              className={cn(
                'ui-btn ui-btn-ghost h-7 rounded-md px-2 text-[11px] ml-auto',
                activeCount > 0 && 'ui-btn-active',
              )}
            >
              <ArrowUpDown size={12} />
              <span>Sort &amp; Filter</span>
              {activeCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-semibold text-white">
                  {activeCount}
                </span>
              )}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="ui-panel-elevated z-[100] w-64 rounded-lg p-2 animate-in fade-in zoom-in-95 duration-100"
              sideOffset={6}
              align="end"
              collisionPadding={12}
            >
              <div className="px-1.5 py-1 mb-1 text-[9px] uppercase tracking-widest text-[var(--text-3)] font-bold">
                Sort by
              </div>
              <div className="space-y-px mb-2">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSortKey(opt.value)}
                    className={cn(
                      'w-full truncate text-left px-2.5 py-1.5 rounded text-xs font-medium transition-colors',
                      sortKey === opt.value
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-3)]',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="border-t border-[var(--border)] pt-2">
                <div className="px-1.5 py-1 mb-1 text-[9px] uppercase tracking-widest text-[var(--text-3)] font-bold">
                  Filter
                </div>
                <div className="px-1.5 mb-2">
                  <p className="text-[10px] text-[var(--text-2)] mb-1">Completeness</p>
                  <TriToggle value={completeFilter} onChange={setCompleteFilter} yesLabel="Complete" noLabel="Incomplete" />
                </div>
                <div className="px-1.5">
                  <p className="text-[10px] text-[var(--text-2)] mb-1">Optimality</p>
                  <TriToggle value={optimalFilter} onChange={setOptimalFilter} yesLabel="Optimal" noLabel="Suboptimal" />
                </div>
              </div>

              {activeCount > 0 && (
                <button
                  onClick={reset}
                  className="mt-2 w-full text-center text-[10px] text-[var(--text-3)] hover:text-[var(--text)] py-1.5 border-t border-[var(--border)]"
                >
                  Reset
                </button>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
          <p className="text-xs text-[var(--text-3)]">No algorithms match the current filters.</p>
          <button onClick={reset} className="mt-2 text-[11px] text-[var(--accent)] hover:underline">
            Reset filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visible.map((algo) => (
            <AlgorithmCard key={algo.id} meta={algo} />
          ))}
        </div>
      )}
    </section>
  );
}
