import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import { X } from '@/components/shared/Icons';

interface DialogHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  titleClassName?: string;
  className?: string;
}

export default function DialogHeader({ title, description, closeLabel, titleClassName, className }: DialogHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between px-5 pt-5 pb-3', className)}>
      <div>
        <Dialog.Title className={cn('text-sm font-semibold text-[var(--text)]', titleClassName)}>{title}</Dialog.Title>
        {description ? (
          <Dialog.Description className="mt-0.5 text-xs text-[var(--text-2)]">{description}</Dialog.Description>
        ) : null}
      </div>
      <Dialog.Close
        className={cn(
          'mt-0.5 flex h-6 w-6 items-center justify-center rounded',
          'text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
        )}
        aria-label={closeLabel}
      >
        <X size={14} />
      </Dialog.Close>
    </div>
  );
}