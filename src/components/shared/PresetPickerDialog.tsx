import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/cn';
import DialogHeader from '@/components/shared/DialogHeader';
import SurfaceCard from '@/components/shared/SurfaceCard';
import StatusBadge from '@/components/shared/StatusBadge';

export interface PresetPickerItem {
  id: string;
  name: string;
  description: string;
  tags?: string[];
}

interface PresetPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  items: PresetPickerItem[];
  onSelect: (itemId: string) => void;
}

export default function PresetPickerDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  items,
  onSelect,
}: PresetPickerDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
            'overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl',
            'focus:outline-none',
          )}
        >
          <DialogHeader
            title={title}
            description={subtitle ?? `${items.length} option${items.length === 1 ? '' : 's'} available`}
            closeLabel="Close preset picker"
            className="border-b border-[var(--border)]"
          />

          <div className="max-h-[70vh] space-y-2 overflow-y-auto px-5 py-4">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  onOpenChange(false);
                }}
                className="w-full text-left"
              >
                <SurfaceCard
                  tone="strong"
                  padding="sm"
                  className={cn('transition-colors hover:border-[var(--accent)]/45 hover:bg-[var(--accent-soft)]/45')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{item.name}</p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-2)]">{item.description}</p>
                    </div>
                    <StatusBadge tone="accent">Demo</StatusBadge>
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.tags.map((tag) => (
                        <StatusBadge key={tag} tone="neutral">{tag}</StatusBadge>
                      ))}
                    </div>
                  )}
                </SurfaceCard>
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}