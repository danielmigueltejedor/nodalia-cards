import type { HomeAssistant } from "./home-assistant";

/**
 * Shared helper surface currently published as `window.NodaliaUtils`.
 * Only the members TypeScript modules call are typed; remaining helpers stay
 * available at runtime on the compatibility global.
 */
export interface HostPointerHoldBinding { (): void; reconnect?: () => void; }
export interface NodaliaUtilsApi {
  isNodaliaSliderChromeHit?: (event: Event) => boolean;
  cancelCardZoneTap?: (host: HTMLElement) => void;
  scheduleCardZoneTap?: (host: HTMLElement, options: { zone?: string; doubleTapMs?: number; onSingle: () => void; onDouble?: () => void }) => void;
  renderEditorCollapsibleSectionHeaderHtml: (options: {
    escapeHtml: (value: unknown) => string; editorLabel: (key: string) => string;
    expanded: boolean; toggleId?: string; titleKey?: string; hintKey?: string;
    showLabelKey?: string; hideLabelKey?: string;
  }) => string;
  editorSortLocale?: (hass: HomeAssistant | null | undefined, language?: string) => string;
  isKeyboardActivationEvent?: (event: Event) => boolean;
  warnStrictServiceDenied?: (label: string, service: unknown) => void;
  applyDefaultConfigNameFromEntity?: <Config extends Record<string, unknown>>(config: Config, hass: HomeAssistant | null | undefined, options?: { previousEntity?: string }) => Config;
  renderEditorCollapsibleToggleHtml: (options: { toggleId: string; expanded: boolean; showLabel: string; hideLabel: string; escapeHtml: (value: unknown) => string }) => string;
  renderReducedMotionStyles?: () => string;
  bindHostPointerHoldGesture?: <Zone>(host: HTMLElement, options: {
    resolveZone: (event: PointerEvent) => Zone | null;
    shouldBeginHold?: (zone: Zone, event: PointerEvent) => boolean;
    onHold: (zone: Zone) => void;
    markHoldConsumedClick?: () => void;
    holdMs?: number; moveTolerancePx?: number;
  }) => HostPointerHoldBinding;
  editorStatesSignature?: (hass: HomeAssistant | null | undefined, language?: string) => string;
  mountIconPickerHost?: (host: HTMLElement, options: {
    hass: HomeAssistant | null | undefined; field?: string; value?: unknown; placeholder?: string;
    onShadowInput?: EventListener; onShadowValueChanged?: EventListener; copyDatasetFromHost?: boolean;
  }) => void;
  captureEditorFocusState: (host: HTMLElement) => EditorFocusState | null;
  restoreEditorFocusState: (host: HTMLElement, state: EditorFocusState | null) => void;
  bindShadowListeners: (host: HTMLElement, listeners: readonly (readonly [string, EventListener, (boolean | AddEventListenerOptions)?])[], key?: string) => boolean;
  releaseShadowListeners: (host: HTMLElement, key?: string) => boolean;
  bindEditorDialogLayoutFix?: (host: HTMLElement) => void;
  releaseEditorDialogLayoutFix?: (host: HTMLElement) => void;
  editorFilteredStatesSignature?: (hass: HomeAssistant | null | undefined, language: string | undefined, predicate: (id: string) => boolean) => string;
  mountEntityPickerHost?: (host: HTMLElement, options: {
    hass: HomeAssistant | null | undefined; field?: string; value?: unknown;
    placeholder?: string; onShadowInput?: EventListener; onShadowValueChanged?: EventListener;
    copyDatasetFromHost?: boolean;
  }) => void;
  isLovelaceHassStatesHydrated?: (hass: HomeAssistant | null | undefined) => boolean;
  isObject(value: unknown): value is Record<string, unknown>;
  deepClone<T>(value: T): T;
  mergeDeep<T>(base: T, override?: unknown): T;
  compactConfig<T>(value: T): T;
  getByPath(target: object, path: string): unknown;
  shouldUseCompactCardLayout(options?: {
    mode?: unknown;
    width?: number;
    gridColumns?: number | null;
    parentWidth?: number | null;
  }): boolean;
  resolveCompactLayoutParentWidth(host?: unknown): number;
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
  sanitizeActionUrl(value: unknown, options?: { allowRelative?: boolean; allowHash?: boolean }): string;
  getEntityFriendlyName(hass: HomeAssistant | null | undefined, entityId: unknown): string;
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
  createEntitySuggestion: (cardType: string, hass: HomeAssistant, entityId: string, options?: {
    domains?: string[];
    label?: string;
    isSupported?: (hass: HomeAssistant, entityId: string) => boolean;
    buildConfig?: (hass: HomeAssistant, entityId: string) => Record<string, unknown>;
  }) => { config: Record<string, unknown>; label?: string } | null;
  registerCustomCard: (metadata: {
    type: string;
    name: string;
    description: string;
    preview?: boolean;
    documentationURL?: string;
  }) => void;
  defineLazyCustomElement: (
    tag: string,
    loadClass: () => CustomElementConstructor,
    options?: { editorTag?: string },
  ) => void;
  renderLovelaceEntityGuardCardHtml?: (
    hass: unknown,
    entityId: unknown,
    options?: Record<string, unknown>,
  ) => string;
  renderCardEmptyStateDocument?: (innerHtml: string, options?: Record<string, unknown>) => string;
  scheduleDeferTimer?: (host: object, callback: () => void, delayMs: number) => number;
  clearDeferTimers?: (host: object) => void;
  renderEditorEngineBannerStyles?: () => string;
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
  renderEditorCardBorderRadiusHtml(options: EditorRadiusOptions): string;
  renderEditorChipBorderRadiusHtml(options: EditorRadiusOptions): string;
  sanitizeCssValue(value: unknown, fallback?: unknown): string;
  applyCardTapActionField?: (
    config: Record<string, unknown>,
    keys: CardActionFieldKeys,
    rawValue: unknown,
    fallback: string,
  ) => void;
}

export interface CardActionFieldKeys {
  actionKey: string;
  serviceKey: string;
  serviceDataKey: string;
  serviceTargetKey: string;
  urlKey: string;
  navigationKey: string;
  newTabKey: string;
}

export interface EditorRadiusOptions {
  escapeHtml: (value: unknown) => string;
  field: string;
  value: string;
  tHeading: string;
  labels: Record<"pill" | "soft" | "round" | "square", string>;
}

/** Snapshot fields actually produced by the shared editor caret helper. */
export interface EditorFocusState {
  selector: string; selectionStart: number | null; selectionEnd: number | null; type: string;
}
