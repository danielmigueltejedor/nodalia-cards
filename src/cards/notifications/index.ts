import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./notifications-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./notifications-config";
import { loadNodaliaNotificationsCard } from "./notifications-card";
import { loadNodaliaNotificationsCardEditor } from "./notifications-editor";
import {
  buildBackgroundMobileWebhookPayload,
  customNotificationTemplateValues,
  formatNotificationTemplate,
  getBackgroundMobileConfigPayload,
  normalizeExternalAlerts,
  referencedNotificationTemplateEntities,
} from "./notifications-helpers";
import {
  BACKGROUND_MOBILE_MAX_CHUNKS,
  MOBILE_DELIVERY_STATES,
  backgroundMobilePayloadOverLimit,
  buildMobileAlertIdentity,
  buildMobileGroupIdentity,
  getNextQuietHoursBoundaryDelay,
  isExplicitSmartEntityMobile,
  isWithinQuietHours,
  normalizeMobileContext,
  normalizeMobilePolicy,
  normalizeQuietHours,
  passesPresenceContext,
  resolvePresenceOccupancy,
  resolveMobileDeliveryState,
  resolveSmartEntityMobilePolicy,
} from "./notifications-runtime";
import type {
  NotificationsMobilePublicApi,
  NotificationsPublicApi,
  NotificationsTemplatesPublicApi,
} from "./notifications-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaNotificationsCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaNotificationsCardEditor);

try {
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Notifications Card",
    description: "Centro inteligente de notificaciones, recomendaciones y acciones.",
    preview: true,
  });
} catch {
  // Picker registration must never prevent the card custom element from loading.
}

const templatesApi = {
  customNotificationTemplateValues,
  formatNotificationTemplate,
  referencedNotificationTemplateEntities,
} as NotificationsTemplatesPublicApi;

const mobileApi = {
  MOBILE_DELIVERY_STATES,
  normalizeMobilePolicy,
  normalizeMobileContext,
  normalizeExternalAlerts,
  normalizeQuietHours,
  isWithinQuietHours,
  resolvePresenceOccupancy,
  passesPresenceContext,
  buildMobileAlertIdentity,
  buildMobileGroupIdentity,
  resolveMobileDeliveryState,
  getBackgroundMobileConfigPayload,
  buildBackgroundMobileWebhookPayload,
  backgroundMobilePayloadOverLimit,
  getNextQuietHoursBoundaryDelay,
  BACKGROUND_MOBILE_MAX_CHUNKS,
  resolveSmartEntityMobilePolicy,
  isExplicitSmartEntityMobile,
  pushExternalAlerts: (...args: unknown[]) => loadNodaliaNotificationsCard().pushExternalAlerts(...args),
} as NotificationsMobilePublicApi;

const publicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
} as NotificationsPublicApi;

const globalScope = globalThis as typeof globalThis & {
  __NODALIA_NOTIFICATIONS_TEMPLATES__?: typeof templatesApi;
  __NODALIA_NOTIFICATIONS_MOBILE__?: typeof mobileApi;
  __NODALIA_NOTIFICATIONS__?: NotificationsPublicApi;
};

globalScope.__NODALIA_NOTIFICATIONS_TEMPLATES__ = templatesApi;
globalScope.__NODALIA_NOTIFICATIONS_MOBILE__ = mobileApi;
globalScope.__NODALIA_NOTIFICATIONS__ = publicApi;
window.__NODALIA_NOTIFICATIONS_TEMPLATES__ = templatesApi;
window.__NODALIA_NOTIFICATIONS_MOBILE__ = mobileApi;
window.__NODALIA_NOTIFICATIONS__ = publicApi;
