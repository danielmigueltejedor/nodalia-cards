export interface NotificationsPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: typeof import("./notifications-config").normalizeConfig;
}

export interface NotificationsTemplatesPublicApi {
  customNotificationTemplateValues: typeof import("./notifications-helpers").customNotificationTemplateValues;
  formatNotificationTemplate: typeof import("./notifications-helpers").formatNotificationTemplate;
  referencedNotificationTemplateEntities: typeof import("./notifications-helpers").referencedNotificationTemplateEntities;
}

export interface NotificationsMobilePublicApi {
  MOBILE_DELIVERY_STATES: ReadonlySet<string>;
  normalizeMobilePolicy: typeof import("./notifications-runtime").normalizeMobilePolicy;
  normalizeMobileContext: typeof import("./notifications-runtime").normalizeMobileContext;
  normalizeExternalAlerts: typeof import("./notifications-normalization").normalizeExternalAlerts;
  normalizeQuietHours: typeof import("./notifications-runtime").normalizeQuietHours;
  isWithinQuietHours: typeof import("./notifications-runtime").isWithinQuietHours;
  resolvePresenceOccupancy: typeof import("./notifications-runtime").resolvePresenceOccupancy;
  passesPresenceContext: typeof import("./notifications-runtime").passesPresenceContext;
  buildMobileAlertIdentity: typeof import("./notifications-runtime").buildMobileAlertIdentity;
  buildMobileGroupIdentity: typeof import("./notifications-runtime").buildMobileGroupIdentity;
  resolveMobileDeliveryState: typeof import("./notifications-runtime").resolveMobileDeliveryState;
  getBackgroundMobileConfigPayload: typeof import("./notifications-helpers").getBackgroundMobileConfigPayload;
  buildBackgroundMobileWebhookPayload: typeof import("./notifications-helpers").buildBackgroundMobileWebhookPayload;
  backgroundMobilePayloadOverLimit: typeof import("./notifications-runtime").backgroundMobilePayloadOverLimit;
  getNextQuietHoursBoundaryDelay: typeof import("./notifications-runtime").getNextQuietHoursBoundaryDelay;
  BACKGROUND_MOBILE_MAX_CHUNKS: number;
  resolveSmartEntityMobilePolicy: typeof import("./notifications-runtime").resolveSmartEntityMobilePolicy;
  isExplicitSmartEntityMobile: typeof import("./notifications-runtime").isExplicitSmartEntityMobile;
  pushExternalAlerts: typeof import("./notifications-helpers").pushExternalAlerts;
}
