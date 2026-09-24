export interface NotificationsPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown, options?: { keepDrafts?: boolean }) => Record<string, unknown>;
}

export interface NotificationsTemplatesPublicApi {
  customNotificationTemplateValues: (...args: unknown[]) => unknown;
  formatNotificationTemplate: (...args: unknown[]) => unknown;
  referencedNotificationTemplateEntities: (...args: unknown[]) => unknown;
}

export interface NotificationsMobilePublicApi {
  MOBILE_DELIVERY_STATES: ReadonlySet<string>;
  normalizeMobilePolicy: (...args: unknown[]) => unknown;
  normalizeMobileContext: (...args: unknown[]) => unknown;
  normalizeExternalAlerts: (...args: unknown[]) => unknown;
  normalizeQuietHours: (...args: unknown[]) => unknown;
  isWithinQuietHours: (...args: unknown[]) => unknown;
  resolvePresenceOccupancy: (...args: unknown[]) => unknown;
  passesPresenceContext: (...args: unknown[]) => unknown;
  buildMobileAlertIdentity: (...args: unknown[]) => unknown;
  buildMobileGroupIdentity: (...args: unknown[]) => unknown;
  resolveMobileDeliveryState: (...args: unknown[]) => unknown;
  getBackgroundMobileConfigPayload: (...args: unknown[]) => unknown;
  buildBackgroundMobileWebhookPayload: (...args: unknown[]) => unknown;
  backgroundMobilePayloadOverLimit: (...args: unknown[]) => unknown;
  getNextQuietHoursBoundaryDelay: (...args: unknown[]) => unknown;
  BACKGROUND_MOBILE_MAX_CHUNKS: number;
  resolveSmartEntityMobilePolicy: (...args: unknown[]) => unknown;
  isExplicitSmartEntityMobile: (...args: unknown[]) => unknown;
  pushExternalAlerts: (...args: unknown[]) => unknown;
}
