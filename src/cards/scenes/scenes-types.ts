export interface ScenesPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown, options?: SceneNormalizationOptions) => NormalizedScenesConfig;
}

export interface SceneRow {
  entity: string;
  name: string;
  icon: string;
  color: string;
}
export interface SceneNormalizationOptions { keepEmpty?: boolean; }
export interface ScenesInput {
  scenes?: unknown;
  styles?: unknown;
  use_entity_icon?: unknown;
  use_entity_picture?: unknown;
}
export interface DashboardScrollSnapshot {
  containers: { el: HTMLElement; left: number; top: number }[];
  winX: number;
  winY: number;
}

export interface NormalizedScenesConfig extends Record<string, unknown> {
  layout: "grid" | "list" | "single";
  columns: number;
  tap_action: string;
  hold_action: string;
  scenes: SceneRow[];
}
