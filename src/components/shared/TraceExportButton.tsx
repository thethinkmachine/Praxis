import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useExportTrace } from '@/hooks/useExportTrace';
import { ChevronDown, Download } from '@/components/shared/Icons';
import { dropdownMenuContentClass, dropdownMenuItemClass } from '@/components/shared/DropdownActionMenu';

export default function TraceExportButton() {
  const { exportJSON, exportCSV, hasTrace } = useExportTrace();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={!hasTrace}
          className="ui-btn h-7 rounded-lg px-2.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={12} />
          Export Trace
          <ChevronDown size={12} className="text-[var(--text-3)]" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={dropdownMenuContentClass('min-w-[140px]')}
          sideOffset={4}
          align="end"
        >
          <DropdownMenu.Item
            onSelect={exportJSON}
            className={dropdownMenuItemClass()}
          >
            <span>{ }</span>
            Export as JSON
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={exportCSV}
            className={dropdownMenuItemClass()}
          >
            <span>⊞</span>
            Export as CSV
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
