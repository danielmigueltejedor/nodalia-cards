import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];

const mobile = window.NodaliaNotificationsMobilePolicy;

export const BACKGROUND_MOBILE_MAX_CHUNKS = mobile.BACKGROUND_MOBILE_MAX_CHUNKS;
export const MOBILE_COOLDOWN_STORAGE_KEY = mobile.MOBILE_COOLDOWN_STORAGE_KEY;
export const MOBILE_DELIVERY_STATES = mobile.MOBILE_DELIVERY_STATES;
export const normalizeMobilePolicy = mobile.normalizeMobilePolicy;
export const resolveSmartEntityMobilePolicy = mobile.resolveSmartEntityMobilePolicy;
export const backgroundMobilePayloadOverLimit = mobile.backgroundMobilePayloadOverLimit;
export const normalizeSmartEntityMobile = mobile.normalizeSmartEntityMobile;
export const normalizeSmartEntityOverrideMobile = mobile.normalizeSmartEntityOverrideMobile;
export const isExplicitSmartEntityMobile = mobile.isExplicitSmartEntityMobile;
export const isWithinQuietHours = mobile.isWithinQuietHours;
export const getNextQuietHoursBoundaryDelay = mobile.getNextQuietHoursBoundaryDelay;
export const normalizeQuietHours = mobile.normalizeQuietHours;
export const normalizeMobileContext = mobile.normalizeMobileContext;
export const resolvePresenceOccupancy = mobile.resolvePresenceOccupancy;
export const passesPresenceContext = mobile.passesPresenceContext;
export const buildMobileAlertIdentity = mobile.buildMobileAlertIdentity;
export const buildMobileGroupIdentity = mobile.buildMobileGroupIdentity;
export const resolveMobileDeliveryState = mobile.resolveMobileDeliveryState;
export const legacyMobilePolicyLabel = mobile.legacyMobilePolicyLabel;
