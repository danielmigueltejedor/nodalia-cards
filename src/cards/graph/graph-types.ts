export interface GraphPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown, options?: { preserveEmptyEntities?: boolean }) => Record<string, unknown>;
  normalizeEditorConfig: (rawConfig?: unknown) => Record<string, unknown>;
}
