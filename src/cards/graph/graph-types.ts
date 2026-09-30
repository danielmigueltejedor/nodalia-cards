export interface GraphPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: typeof import("./graph-config").normalizeConfig;
  normalizeEditorConfig: typeof import("./graph-config").normalizeEditorConfig;
}
