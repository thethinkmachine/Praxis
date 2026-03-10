/**
 * AlgorithmPage — the ONE unified layout component for all algorithm pages.
 * Follows SearchPage's design: compact title strip, tabbed visualization,
 * resizable panels for State+Metrics and Pseudocode.
 * Optionally includes a collapsible configuration sidebar on the left.
 *
 * IMPORTANT: react-resizable-panels v4 interprets numeric sizes as PIXELS
 * and string sizes as PERCENTAGES. Always use strings like "20" for percentage-based sizing.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Group, Panel, usePanelRef } from 'react-resizable-panels';
import type { PanelSize } from 'react-resizable-panels';
import { cn } from '@/lib/cn';
import { useAlgorithmPage } from '@/hooks/useAlgorithmPage';
import ResizeHandle from '@/components/layout/ResizeHandle';
import PanelWrapper from '@/components/layout/PanelWrapper';
import AlgorithmTitleStrip from '@/components/shared/AlgorithmTitleStrip';
import AlgorithmNotFound from '@/components/shared/AlgorithmNotFound';
import TabStrip from '@/components/shared/TabStrip';
import ControlPanel from '@/components/module/ControlPanel';
import MetricsPanel from '@/components/module/MetricsPanel';
import PseudocodePanel from '@/components/module/PseudocodePanel';
import StatePanel from '@/components/module/StatePanel';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import ProblemImportExportButton from '@/components/shared/ProblemImportExportButton';
import TerminalPanel from '@/components/module/TerminalPanel';
import type { AlgorithmCategory } from '@/types';
import type { ProblemCategory } from '@/types/problem';

export interface TabDefinition {
  id: string;
  label: string;
  /** The visualization component to render */
  content: React.ReactNode;
  /** If true, stays mounted but invisible when another tab is active (for expensive components like graph canvases) */
  keepMounted?: boolean;
}

export interface AlgorithmPageProps {
  algorithmId: string;
  problem: unknown;
  /** Optional payload used for import/export/save actions instead of execution problem. */
  problemForActions?: unknown;
  category: AlgorithmCategory;
  problemCategory: ProblemCategory;
  onProblemImport: (problem: unknown) => void;
  /** Visualization tabs — if only 1, no tab strip is shown */
  tabs: TabDefinition[];
  /** Action buttons rendered in the title strip's right side (Random button, Demo picker, etc.) */
  titleActions?: React.ReactNode;
  /** Configuration UI shown in collapsible left sidebar. If undefined, no sidebar is rendered. */
  configPanel?: React.ReactNode;
  /** Whether the configuration sidebar should be open by default. Defaults to true. */
  defaultConfigOpen?: boolean;
}

export default function AlgorithmPage({
  algorithmId,
  problem,
  problemForActions,
  category,
  problemCategory,
  onProblemImport,
  tabs,
  titleActions,
  configPanel,
  defaultConfigOpen = true,
}: AlgorithmPageProps) {
  const { runner, step, loadError, loadWarning } = useAlgorithmPage(algorithmId, problem);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');
  const [configOpen, setConfigOpen] = useState(defaultConfigOpen);

  // Imperative ref for the config panel — needed for programmatic collapse/expand
  const configPanelRef = usePanelRef();

  // Update activeTab if tabs change and current tab no longer exists
  if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) {
    setActiveTab(tabs[0].id);
  }

  // Sync panel collapse state when toggle button changes configOpen
  useEffect(() => {
    const panel = configPanelRef.current;
    if (!panel) return;
    if (configOpen) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [configOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect user-initiated collapse/expand via dragging (skip initial mount call)
  const handleConfigResize = useCallback(
    (size: PanelSize, _id: string | number | undefined, prevSize: PanelSize | undefined) => {
      if (prevSize === undefined) return; // skip initial mount
      setConfigOpen(size.asPercentage > 0);
    },
    [],
  );

  if (!runner) {
    return <AlgorithmNotFound algorithmId={algorithmId} />;
  }

  const hasConfig = !!configPanel;
  const hasTabs = tabs.length > 1;
  const actionProblem = problemForActions ?? problem;

  return (
    <div className="h-full overflow-hidden flex flex-col">
      {/* Title strip */}
      <AlgorithmTitleStrip
        meta={runner.meta}
        loadError={loadError}
        loadWarning={loadWarning}
        problemCategory={problemCategory}
        showConfigButton={hasConfig}
        configOpen={hasConfig && configOpen}
        onToggleConfig={() => setConfigOpen(v => !v)}
        actions={
          <div className="flex items-center gap-2">
            {titleActions}
          </div>
        }
        problemActions={
          <ProblemImportExportButton
            problem={actionProblem}
            algorithmId={algorithmId}
            problemCategory={problemCategory}
            onImport={onProblemImport}
          />
        }
      />

      {/* Main resizable area */}
      <Group orientation="horizontal" className="flex-1 min-h-0">
        {/* Configuration sidebar — conditional, each as a direct child (no Fragment) */}
        {hasConfig && (
          <Panel
            panelRef={configPanelRef}
            defaultSize="20"
            minSize="12"
            maxSize="35"
            collapsible
            collapsedSize="0"
            onResize={handleConfigResize}
          >
            <PanelWrapper title="Configuration">
              {configPanel}
            </PanelWrapper>
          </Panel>
        )}
        {hasConfig && <ResizeHandle orientation="horizontal" />}

        {/* Visualization panel with optional tabs */}
        <Panel defaultSize={hasConfig ? '45' : '60'} minSize="30" maxSize="80">
          <div className="h-full overflow-hidden flex flex-col">
            {/* Tab strip — only shown if multiple tabs */}
            {hasTabs && (
              <TabStrip
                tabs={tabs.map(t => ({ id: t.id, label: t.label }))}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}

            {/* Tab content */}
            <div className="flex-1 relative overflow-hidden">
              <ErrorBoundary>
                {tabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  const shouldMount = isActive || tab.keepMounted;

                  if (!shouldMount) return null;

                  return (
                    <div
                      key={tab.id}
                      className={cn(
                        'absolute inset-0',
                        !isActive && 'invisible pointer-events-none',
                      )}
                    >
                      {tab.content}
                    </div>
                  );
                })}
              </ErrorBoundary>
            </div>
          </div>
        </Panel>

        <ResizeHandle orientation="horizontal" />

        {/* State + Metrics panel */}
        <Panel defaultSize="20" minSize="10" maxSize="40" collapsible collapsedSize="0">
          <PanelWrapper title="State & Metrics">
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <StatePanel step={step} algorithmCategory={category} />
              </div>
              <div className="shrink-0 border-t border-[var(--border)]">
                <MetricsPanel
                  metrics={step?.metrics ?? null}
                  phase={step?.phase}
                  description={step?.description}
                  algorithmCategory={category}
                />
              </div>
            </div>
          </PanelWrapper>
        </Panel>

        <ResizeHandle orientation="horizontal" />

        {/* Pseudocode panel */}
        <Panel defaultSize={hasConfig ? '15' : '20'} minSize="10" maxSize="40" collapsible collapsedSize="0">
          <PanelWrapper title="Pseudocode">
            <PseudocodePanel
              lines={runner.pseudocode}
              activeLine={step?.pseudocodeLine ?? -1}
              algorithmName={runner.meta.name}
            />
          </PanelWrapper>
        </Panel>
      </Group>

      {/* Control panel */}
      <div className="border-t border-[var(--border)] shrink-0">
        <ControlPanel />
      </div>
    </div>
  );
}
