import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface TitleBarActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label?: string;
  iconOnly?: boolean;
  tone?: 'default' | 'accent';
}

export function TitleBarActionGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-1.5', className)}>{children}</div>;
}

export function TitleBarActionButton({
  icon,
  label,
  iconOnly = false,
  tone = 'default',
  className,
  type = 'button',
  children,
  ...props
}: TitleBarActionButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'ui-btn h-7 rounded-lg px-2.5 text-[11px] font-medium',
        iconOnly && 'ui-btn-icon w-7 px-0',
        tone === 'accent' && 'ui-btn-active',
        className,
      )}
      {...props}
    >
      {icon}
      {!iconOnly && (label ?? children)}
      {iconOnly ? children : null}
    </button>
  );
}