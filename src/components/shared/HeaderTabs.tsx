import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/cn';

interface HeaderTabsProps {
  tabs: { id: string; label: string; disabled?: boolean; icon?: React.ReactNode }[];
  activeTab: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
  size?: 'compact' | 'default';
  mode?: 'button' | 'tabs';
}

export default function HeaderTabs({ tabs, activeTab, onTabChange, className, size = 'default', mode = 'button' }: HeaderTabsProps) {
  const itemClass = (disabled?: boolean) => cn(
    'ui-btn ui-btn-ghost whitespace-nowrap rounded-lg font-medium',
    size === 'compact' ? 'h-8 px-2 text-[11px]' : 'h-8 px-2.5 text-[11px] font-mono tracking-wide',
    'data-[active=true]:border-[var(--accent)]/35 data-[active=true]:bg-[var(--accent-soft)] data-[active=true]:text-[var(--text)]',
    disabled && 'cursor-not-allowed opacity-50',
  );

  if (mode === 'tabs') {
    return (
      <Tabs.List className={cn('flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-none', className)}>
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.id} value={tab.id} disabled={tab.disabled} className={itemClass(tab.disabled)} data-active={activeTab === tab.id}>
            {tab.icon}
            <span>{tab.label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1 overflow-x-auto scrollbar-none', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange?.(tab.id)}
          disabled={tab.disabled}
          className={itemClass(tab.disabled)}
          data-active={activeTab === tab.id}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}