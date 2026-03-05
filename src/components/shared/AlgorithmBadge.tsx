import { cn } from '@/lib/cn';
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
    icon: '🔍',
    colorClass: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
};

export default function AlgorithmBadge({ category, size = 'sm' }: AlgorithmBadgeProps) {
  const config = CATEGORY_CONFIG[category];
  if (!config) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        config.colorClass,
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      )}
    >
      <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{config.icon}</span>
      {config.label}
    </span>
  );
}
