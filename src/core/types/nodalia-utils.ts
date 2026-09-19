import type { HomeAssistant } from "./home-assistant";

/**
 * Shared helper surface currently published as `window.NodaliaUtils`.
 * Only the members TypeScript modules call are typed; remaining helpers stay
 * available at runtime on the compatibility global.
 */
export interface NodaliaUtilsApi {
  isObject(value: unknown): value is Record<string, unknown>;
  deepClone<T>(value: T): T;
  mergeDeep<T>(base: T, override?: unknown): T;
  compactConfig<T>(value: T): T;
  getByPath(target: object, path: string): unknown;
  shouldUseCompactCardLayout(options?: {
    mode?: unknown;
    width?: number;
    gridColumns?: number | null;
  }): boolean;
  shouldShowCompactCardTitle(options?: {
    width?: number;
  }): boolean;
  isUnsafeConfigPathKey(key: PropertyKey): boolean;
  setByPath(target: object, path: string, value: unknown): void;
  deleteByPath(target: object, path: string): void;
  clamp(value: number, min: number, max: number): number;
  escapeHtml(value: unknown): string;
  escapeSelectorValue(value: unknown): string;
  fireEvent(
    node: EventTarget | null | undefined,
    type: string,
    detail?: unknown,
    options?: Record<string, unknown>,
  ): void;
  normalizeTextKey(value: unknown): string;
  findStubEntityIds(
    hass: HomeAssistant | null | undefined,
    entities: unknown,
    entitiesFallback: unknown,
    domains: unknown,
    limit?: number,
  ): string[];
  normalizeSecurityConfig?: (security: unknown, defaults?: unknown) => Record<string, unknown>;
  sanitizeStyleTree?: (candidate: unknown, fallback: unknown) => unknown;
  stripEqualToDefaults?: (config: unknown, defaults: unknown) => unknown;
  registerCustomCard: (metadata: {
    type: string;
    name: string;
    description: string;
    preview?: boolean;
    documentationURL?: string;
  }) => void;
  renderLovelaceEntityGuardCardHtml?: (
    hass: unknown,
    entityId: unknown,
    options?: Record<string, unknown>,
  ) => string;
  renderCardEmptyStateDocument?: (innerHtml: string, options?: Record<string, unknown>) => string;
  scheduleDeferTimer?: (host: object, callback: () => void, delayMs: number) => unknown;
  clearDeferTimers?: (host: object) => void;
  engineStatusSignature?: (engine: unknown) => string;
  renderEditorEngineBannerHtml?: (options: Record<string, unknown>) => string;
  postHomeAssistantWebhook?: (webhookId: string, body: unknown, hass?: unknown) => Promise<unknown>;
  invokeHomeAssistantService?: (
    host: object,
    hass: unknown,
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: Record<string, unknown> | null,
  ) => unknown;
  clampEditorDialogScroll?: (editorHost: object) => void;
  sanitizeCssValue(value: unknown, fallback?: unknown): string;
}
