import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const mergeConfig = utils.mergeDeep.bind(utils) as NodaliaUtilsApi["mergeDeep"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const isUnsafeConfigPathKey = utils.isUnsafeConfigPathKey.bind(utils) as NodaliaUtilsApi["isUnsafeConfigPathKey"];
export const getByPath = utils.getByPath.bind(utils) as NodaliaUtilsApi["getByPath"];

const model = window.NodaliaRoomSummaryModel;

export const normalizeEntityField = model.normalizeEntityField;
export const collectHubMediaPlayerIds = model.hubMediaPlayerIds;
export const finiteNumber = model.finiteNumber;
export const isUnavailable = model.isUnavailable;
export const stateIsOn = model.stateIsOn;
export const stateIsOpen = model.stateIsOpen;
export const stateIsUnlocked = model.stateIsUnlocked;
export const formatMetric = model.formatMetric;
export const getState = model.getState;
export const hasNormalizedRoomContent = model.hasRoomContent;
export const buildNormalizedRoomSummary = model.buildRoomSummary;
