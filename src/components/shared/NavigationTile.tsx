import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import StatusBadge from '@/components/shared/StatusBadge';

interface NavigationTileProps {
  to: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  tone?: 'default' | 'accent' | 'success';
  badge?: string;
  badgeTone?: 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'neutral';
  className?: string;
}

const ICON_TONES = {
  default: 'text-[var(--accent)]',
  accent: 'text-[var(--accent)]',
  success: 'text-[var(--success)]',
};

export default function NavigationTile({
  to,
  title,
  description,
  icon,
  tone = 'default',
  badge,
  badgeTone = 'neutral',
  className,
}: NavigationTileProps) {
  return (
    <Link
      to={to}
      className={cn(
        'group rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/75 p-4 transition-colors',
        'hover:border-[var(--accent)]/60 hover:bg-[var(--accent-soft)]',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon ? (
          <div className={cn('rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2', ICON_TONES[tone])}>
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
            {badge ? <StatusBadge tone={badgeTone}>{badge}</StatusBadge> : null}
          </div>
          {description ? <p className="mt-1 text-xs leading-relaxed text-[var(--text-2)]">{description}</p> : null}
        </div>
      </div>
    </Link>
  );
}