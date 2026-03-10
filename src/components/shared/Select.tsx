import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '@/lib/cn';
import { ChevronDown, ChevronUp, Check } from '@/components/shared/Icons';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
}

export default function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  className,
  triggerClassName,
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-9 w-full items-center justify-between rounded border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text)] outline-none focus:border-[var(--accent)]/50 focus:ring-1 focus:ring-[var(--accent)]/50 disabled:cursor-not-allowed disabled:opacity-50 font-mono transition-colors group',
          triggerClassName
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-3 w-3 text-[var(--text-3)] group-hover:text-[var(--text-2)] transition-colors" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            'relative z-[100] min-w-[var(--radix-select-trigger-width)] max-h-[300px] overflow-hidden rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] shadow-xl animate-in fade-in-0 slide-in-from-top-1',
            className
          )}
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center h-6 bg-[var(--surface-3)] text-[var(--text-3)] cursor-default">
            <ChevronUp className="h-3 w-3" />
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  'relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-xs text-[var(--text-2)] outline-none focus:bg-[var(--accent)]/10 focus:text-[var(--accent)] data-[state=checked]:text-[var(--accent)] data-[state=checked]:font-semibold data-[disabled]:pointer-events-none data-[disabled]:opacity-50 font-mono transition-colors'
                )}
              >
                <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3 w-3" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center h-6 bg-[var(--surface-3)] text-[var(--text-3)] cursor-default">
            <ChevronDown className="h-3 w-3" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
