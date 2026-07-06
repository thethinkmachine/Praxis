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
import { usePreferencesStore } from '@/store/usePreferencesStore';
import ResizeHandle from '@/components/layout/ResizeHandle';
import PanelWrapper from '@/components/layout/PanelWrapper';
import AlgorithmTitleStrip from '@/components/shared/AlgorithmTitleStrip';
import AlgorithmNotFound from '@/components/shared/AlgorithmNotFound';
import TabStrip from '@/components/shared/TabStrip';
import ControlPanel from '@/components/module/ControlPanel';
import StateMetricsPanel from '@/components/module/StateMetricsPanel';
import PseudocodePanel from '@/components/module/PseudocodePanel';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import ProblemImportExportButton from '@/components/shared/ProblemImportExportButton';
import type { ProblemCategory } from '@/types/problem';
import type { ExecutionLoadContext } from '@/store/execution.store';

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
  problemCategory: ProblemCategory;
  onProblemImport: (problem: unknown) => void;
  /** Visualization tabs — if only 1, no tab strip is shown */
  tabs: TabDefinition[];
  /** Action buttons rendered in the title strip's right side (Random button, Demo picker, etc.) */
  titleActions?: React.ReactNode;
  /** Optional route builder used by the title strip's algorithm switcher. */
  buildAlgorithmRoute?: (algorithmId: string) => string;
  /** Callback fired when the user selects "Load Demo" from the Problem dropdown.
   *  The page should respond by opening its DemoProblemPicker. */
  onDemoRequest?: () => void;
  /** Configuration UI shown in collapsible left sidebar. If undefined, no sidebar is rendered. */
  configPanel?: React.ReactNode;
  /** Context key used by the execution store to decide whether trace position should be preserved. */
  executionContext?: ExecutionLoadContext;
}

export default function AlgorithmPage({
  algorithmId,
  problem,
  problemForActions,
  problemCategory,
  onProblemImport,
  tabs,
  titleActions,
  buildAlgorithmRoute,
  configPanel,
  onDemoRequest,
  executionContext,
}: AlgorithmPageProps) {
  const { runner, step, loadError, loadWarning } = useAlgorithmPage(algorithmId, problem, executionContext);
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? '');
  const configVisible = usePreferencesStore((state) => state.configVisible);
  const toggle = usePreferencesStore((state) => state.toggle);
  const pseudocodeVisible = usePreferencesStore((state) => state.pseudocodeVisible);
  const metricsVisible = usePreferencesStore((state) => state.metricsVisible);
  const statePanelVisible = usePreferencesStore((state) => state.statePanelVisible);
  const showStateMetricsPanel = metricsVisible || statePanelVisible;
  const resolvedActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : (tabs[0]?.id ?? '');

  // Imperative ref for the config panel — needed for programmatic collapse/expand
  const configPanelRef = usePanelRef();
  const stateMetricsPanelRef = usePanelRef();
  const pseudocodePanelRef = usePanelRef();

  // Sync panel collapse state when toggle button changes configVisible
  useEffect(() => {
    const panel = configPanelRef.current;
    if (!panel) return;
    if (configVisible) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [configVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const panel = stateMetricsPanelRef.current;
    if (!panel) return;
    if (showStateMetricsPanel) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [showStateMetricsPanel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const panel = pseudocodePanelRef.current;
    if (!panel) return;
    if (pseudocodeVisible) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [pseudocodeVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect user-initiated collapse/expand via dragging (skip initial mount call)
  const handleConfigResize = useCallback(
    (size: PanelSize, _id: string | number | undefined, prevSize: PanelSize | undefined) => {
      if (prevSize === undefined) return; // skip initial mount
      const isExpanded = size.asPercentage > 0;
      if (isExpanded !== configVisible) {
        toggle('configVisible');
      }
    },
    [configVisible, toggle],
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
        buildAlgorithmRoute={buildAlgorithmRoute}
        showConfigButton={hasConfig}
        configOpen={hasConfig && configVisible}
        onToggleConfig={() => toggle('configVisible')}
        unifiedMode
        actions={
          <div className="flex items-center gap-1.5">
            {titleActions}
          </div>
        }
        problemActions={
          <ProblemImportExportButton
            problem={actionProblem}
            algorithmId={algorithmId}
            problemCategory={problemCategory}
            onImport={onProblemImport}
            onDemoRequest={onDemoRequest}
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
            {configPanel}
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
                  activeTab={resolvedActiveTab}
                  onTabChange={setActiveTab}
                />
              )}

            {/* Tab content */}
            <div className="flex-1 relative overflow-hidden">
              <ErrorBoundary>
                {tabs.map(tab => {
                  const isActive = resolvedActiveTab === tab.id;
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
        <Panel
          panelRef={stateMetricsPanelRef}
          defaultSize="20"
          minSize="10"
          maxSize="40"
          collapsible
          collapsedSize="0"
        >
          <PanelWrapper title="State & Metrics">
            <StateMetricsPanel step={step} showState={statePanelVisible} showMetrics={metricsVisible} />
          </PanelWrapper>
        </Panel>

        <ResizeHandle orientation="horizontal" />

        {/* Pseudocode panel */}
        <Panel
          panelRef={pseudocodePanelRef}
          defaultSize={hasConfig ? '15' : '20'}
          minSize="10"
          maxSize="40"
          collapsible
          collapsedSize="0"
        >
          <PanelWrapper title="Pseudocode" subtitle={runner.meta.name}>
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
