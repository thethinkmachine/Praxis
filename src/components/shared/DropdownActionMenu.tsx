import { cn } from '@/lib/cn';

export function dropdownMenuContentClass(className?: string) {
  return cn('ui-panel-elevated z-[110] min-w-[160px] rounded-lg py-1', className);
}

export function dropdownMenuItemClass(className?: string) {
  return cn(
    'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-[var(--text)] outline-none',
    'hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]',
    className,
  );
}

export function dropdownMenuLabelClass(className?: string) {
  return cn('px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]', className);
}