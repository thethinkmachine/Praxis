import type {
  LogEntry,
  PanelChipItem,
  PanelChipVariant,
  PanelKeyValueItem,
  PanelNodeItem,
  PanelSection,
} from '@/types/step';

export function createLog(
  message: string,
  level: LogEntry['level'] = 'info',
  stepIndex?: number
): LogEntry {
  return {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    level,
    message,
    stepIndex,
  };
}

type PanelListInput<T> = Iterable<T> | readonly T[] | null | undefined;
type PanelOrder = 'natural' | 'reverse';

export interface PanelCollectionSpec {
  title: string;
  items: PanelListInput<string>;
  variant?: PanelChipVariant;
  order?: PanelOrder;
  detailOf?: (id: string, index: number) => string | undefined;
}

export interface GraphStatePanelsConfig {
  labelOf: (id: string) => string;
  currentNode?: string | null;
  currentTitle?: string;
  solutionPath?: PanelListInput<string>;
  solutionTitle?: string;
  collections: PanelCollectionSpec[];
}

interface LegacyGraphStatePanelsState {
  frontier?: PanelListInput<string>;
  explored?: PanelListInput<string>;
  frontierF?: PanelListInput<string>;
  frontierB?: PanelListInput<string>;
  exploredF?: PanelListInput<string>;
  exploredB?: PanelListInput<string>;
  foundPath?: PanelListInput<string>;
}

interface LegacyGraphStatePanelsOptions {
  currentNode?: string | null;
  solutionPath?: PanelListInput<string>;
  frontierOrder?: PanelOrder;
}

function toArray<T>(items: PanelListInput<T>): T[] {
  if (!items) return [];
  return Array.isArray(items) ? [...items] : Array.from(items);
}

function applyOrder<T>(items: T[], order: PanelOrder = 'natural'): T[] {
  return order === 'reverse' ? [...items].reverse() : items;
}

function buildChipItems(
  ids: PanelListInput<string>,
  labelOf: (id: string) => string,
  variant: PanelChipVariant,
  options?: {
    order?: PanelOrder;
    detailOf?: (id: string, index: number) => string | undefined;
  },
): PanelChipItem[] {
  const orderedIds = applyOrder(toArray(ids), options?.order);
  return orderedIds.map((id, index) => ({
    id,
    label: labelOf(id),
    detail: options?.detailOf?.(id, index),
    variant,
  }));
}

export const statePanels = {
  chips(
    title: string,
    items: PanelChipItem[],
  ): PanelSection {
    return {
      type: 'chips',
      title,
      count: items.length,
      items,
    };
  },

  nodes(
    title: string,
    items: PanelNodeItem[],
  ): PanelSection {
    return {
      type: 'nodes',
      title,
      count: items.length,
      items,
    };
  },

  keyValue(
    title: string,
    items: PanelKeyValueItem[],
  ): PanelSection {
    return {
      type: 'key-value',
      title,
      count: items.length,
      items,
    };
  },

  collection(
    spec: PanelCollectionSpec,
    labelOf: (id: string) => string,
  ): PanelSection {
    const items = buildChipItems(
      spec.items,
      labelOf,
      spec.variant ?? 'explored',
      { order: spec.order, detailOf: spec.detailOf },
    );
    return statePanels.chips(spec.title, items);
  },

  currentNode(
    currentNode: string | null | undefined,
    labelOf: (id: string) => string,
    title: string = 'Current Node',
  ): PanelSection | null {
    if (!currentNode) return null;
    return statePanels.chips(title, buildChipItems([currentNode], labelOf, 'current'));
  },

  solutionPath(
    path: PanelListInput<string>,
    labelOf: (id: string) => string,
    title: string = 'Solution Path',
  ): PanelSection | null {
    const items = buildChipItems(path, labelOf, 'path');
    if (items.length === 0) return null;
    return statePanels.chips(title, items);
  },
};

function isGraphStatePanelsConfig(value: GraphStatePanelsConfig | LegacyGraphStatePanelsState): value is GraphStatePanelsConfig {
  return typeof (value as GraphStatePanelsConfig).labelOf === 'function'
    && Array.isArray((value as GraphStatePanelsConfig).collections);
}

function buildLegacyGraphStatePanels(
  state: LegacyGraphStatePanelsState,
  labelOf: (id: string) => string,
  frontierTitle: string = 'Frontier',
  options?: LegacyGraphStatePanelsOptions,
): PanelSection[] {
  const hasBidirectionalFrontiers = state.frontierF !== undefined || state.frontierB !== undefined;
  const hasBidirectionalExplored = state.exploredF !== undefined || state.exploredB !== undefined;

  const collections: PanelCollectionSpec[] = [];

  if (hasBidirectionalFrontiers) {
    collections.push(
      { title: 'Forward Frontier', items: state.frontierF, variant: 'frontier' },
      { title: 'Backward Frontier', items: state.frontierB, variant: 'frontier' },
    );
  } else {
    collections.push({
      title: frontierTitle,
      items: state.frontier,
      variant: 'frontier',
      order: options?.frontierOrder,
    });
  }

  if (hasBidirectionalExplored) {
    collections.push(
      { title: 'Forward Explored', items: state.exploredF, variant: 'explored' },
      { title: 'Backward Explored', items: state.exploredB, variant: 'explored' },
    );
  } else {
    collections.push({
      title: 'Explored',
      items: state.explored,
      variant: 'explored',
    });
  }

  return buildGraphStatePanels({
    labelOf,
    currentNode: options?.currentNode,
    solutionPath: options?.solutionPath ?? state.foundPath,
    collections,
  });
}

export function buildGraphStatePanels(config: GraphStatePanelsConfig): PanelSection[];
export function buildGraphStatePanels(
  state: LegacyGraphStatePanelsState,
  labelOf: (id: string) => string,
  frontierTitle?: string,
  options?: LegacyGraphStatePanelsOptions,
): PanelSection[];
export function buildGraphStatePanels(
  configOrState: GraphStatePanelsConfig | LegacyGraphStatePanelsState,
  labelOf?: (id: string) => string,
  frontierTitle?: string,
  options?: LegacyGraphStatePanelsOptions,
): PanelSection[] {
  if (!isGraphStatePanelsConfig(configOrState)) {
    if (!labelOf) throw new Error('labelOf is required when using legacy graph state panels');
    return buildLegacyGraphStatePanels(configOrState, labelOf, frontierTitle, options);
  }

  const config = configOrState;
  const panels: PanelSection[] = [];

  const currentPanel = statePanels.currentNode(
    config.currentNode,
    config.labelOf,
    config.currentTitle,
  );
  if (currentPanel) panels.push(currentPanel);

  const pathPanel = statePanels.solutionPath(
    config.solutionPath,
    config.labelOf,
    config.solutionTitle,
  );
  if (pathPanel) panels.push(pathPanel);

  for (const collection of config.collections) {
    panels.push(statePanels.collection(collection, config.labelOf));
  }

  return panels;
}
