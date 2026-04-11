import { cn } from '@/lib/cn';
import StatusBadge from '@/components/shared/StatusBadge';
import type { AlgorithmCategory } from '@/types';

interface AlgorithmBadgeProps {
  category: AlgorithmCategory;
  size?: 'sm' | 'md';
}

const CATEGORY_CONFIG: Record<
  AlgorithmCategory,
  { label: string; icon: string; colorClass: string }
> = {
  'uninformed-search': {
    label: 'Uninformed Search',
    icon: 'US //',
    colorClass: 'ui-pill-accent',
  },
  'informed-search': {
    label: 'Informed Search',
    icon: 'IS //',
    colorClass: 'ui-pill-purple',
  },
  'game-playing': {
    label: 'Game Playing',
    icon: 'GP //',
    colorClass: 'ui-pill-warning',
  },
  'local-search': {
    label: 'Local Search',
    icon: 'LS //',
    colorClass: 'ui-pill-success',
  },
  'planning': {
    label: 'Planning',
    icon: 'PL //',
    colorClass: 'ui-pill-accent',
  },
  'constraint-satisfaction': {
    label: 'Constraint Satisfaction',
    icon: 'CSP //',
    colorClass: 'ui-pill-purple',
  },
};

export default function AlgorithmBadge({ category, size = 'sm' }: AlgorithmBadgeProps) {
  const config = CATEGORY_CONFIG[category];
  if (!config) return null;

  return (
    <StatusBadge
      tone={
        config.colorClass === 'ui-pill-accent'
          ? 'accent'
          : config.colorClass === 'ui-pill-purple'
            ? 'purple'
            : config.colorClass === 'ui-pill-warning'
              ? 'warning'
              : 'success'
      }
      size={size === 'sm' ? 'sm' : 'md'}
      className="font-medium"
    >
      <span className={cn('font-mono uppercase', size === 'sm' ? 'text-[9px]' : 'text-[10px]')}>
        {config.icon}
      </span>
      {config.label}
    </StatusBadge>
  );
}
