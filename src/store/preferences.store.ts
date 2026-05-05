import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

type BooleanKeys = 'sidebarCollapsed' | 'pseudocodeVisible' | 'metricsVisible'
  | 'statePanelVisible' | 'autoFitGraph' | 'showEdgeWeights'
  | 'showHeuristicValues' | 'animationEnabled' | 'darkMode'
  | 'terminalExpanded' | 'configVisible';

interface PreferencesState {
  sidebarCollapsed: boolean;
  pseudocodeVisible: boolean;
  metricsVisible: boolean;
  statePanelVisible: boolean;
  configVisible: boolean;
  autoFitGraph: boolean;
  showEdgeWeights: boolean;
  showHeuristicValues: boolean;
  animationEnabled: boolean;
  darkMode: boolean;
  terminalExpanded: boolean;

  // Panel collapse state keyed by page context (e.g. 'search', 'module')
  collapsedPanels: Record<string, string[]>;

  toggle: (key: BooleanKeys) => void;
  set: (key: BooleanKeys, value: boolean) => void;
  togglePanelCollapse: (context: string, panelId: string) => void;
  resetPanelLayout: (context: string) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    immer((set) => ({
      sidebarCollapsed: true,
      pseudocodeVisible: false,
      metricsVisible: true,
      statePanelVisible: true,
      configVisible: false,
      autoFitGraph: true,
      showEdgeWeights: true,
      showHeuristicValues: true,
      animationEnabled: true,
      darkMode: true,
      terminalExpanded: false,
      collapsedPanels: {},

      toggle: (key) => set(state => {
        state[key] = !state[key];
      }),

      set: (key, value) => set(state => {
        state[key] = value;
      }),

      togglePanelCollapse: (context, panelId) => set(state => {
        const panels = state.collapsedPanels[context] ?? [];
        const idx = panels.indexOf(panelId);
        if (idx >= 0) {
          panels.splice(idx, 1);
        } else {
          panels.push(panelId);
        }
        state.collapsedPanels[context] = panels;
      }),

      resetPanelLayout: (context) => set(state => {
        delete state.collapsedPanels[context];
      }),
    })),
    { name: 'praxis-preferences' }
  )
);
