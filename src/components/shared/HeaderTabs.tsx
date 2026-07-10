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

const tabItemBase = (size: 'compact' | 'default', disabled?: boolean) =>
  cn(
    // Layout & shape
    'relative inline-flex items-center gap-1.5 whitespace-nowrap',
    'select-none outline-none transition-colors duration-150',
    'focus-visible:ring-2 focus-visible:ring-[var(--accent)]/20 focus-visible:ring-inset',
    // Size
    size === 'compact'
      ? 'h-9 px-2.5 text-[11px]'
      : 'h-10 px-3 text-[11px] font-mono tracking-wide',
    // Default state
    'text-[var(--text-3)] hover:text-[var(--text-2)]',
    // Active state — bright text + accent underline via after-pseudo
    'data-[active=true]:text-[var(--text)]',
    // Underline indicator
    'after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-t-full',
    'after:bg-[var(--accent)] after:opacity-0 after:transition-opacity after:duration-150',
    'data-[active=true]:after:opacity-100',
    disabled && 'cursor-not-allowed opacity-40',
  );

export default function HeaderTabs({ tabs, activeTab, onTabChange, className, size = 'default', mode = 'button' }: HeaderTabsProps) {
  if (mode === 'tabs') {
    return (
      <Tabs.List className={cn('flex min-w-0 items-center overflow-x-auto scrollbar-none', className)}>
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            className={tabItemBase(size, tab.disabled)}
            data-active={activeTab === tab.id}
          >
            {tab.icon && <span className="opacity-70 data-[active=true]:opacity-100">{tab.icon}</span>}
            <span>{tab.label}</span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center overflow-x-auto scrollbar-none', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange?.(tab.id)}
          disabled={tab.disabled}
          className={tabItemBase(size, tab.disabled)}
          data-active={activeTab === tab.id}
        >
          {tab.icon && <span className="opacity-70">{tab.icon}</span>}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
