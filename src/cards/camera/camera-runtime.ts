import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;
const streamModel = window.NodaliaCameraStreamModel;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const getByPath = utils.getByPath.bind(utils) as NodaliaUtilsApi["getByPath"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];

export const buildGo2rtcViewerUrl = streamModel.buildGo2rtcViewerUrl.bind(streamModel);
export const sanitizeIframeUrl = streamModel.sanitizeIframeUrl.bind(streamModel);
export const buildGo2rtcWebSocketEndpoint = streamModel.buildGo2rtcWebSocketEndpoint.bind(streamModel);
export const buildFrigateGo2rtcPath = streamModel.buildFrigateGo2rtcPath.bind(streamModel);
export const isMixedContentUrl = streamModel.isMixedContentUrl.bind(streamModel);

