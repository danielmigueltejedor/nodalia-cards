import type { NodaliaUtilsApi } from "../../core/types/nodalia-utils";

const utils: NodaliaUtilsApi = window.NodaliaUtils;

export const isObject = utils.isObject.bind(utils) as NodaliaUtilsApi["isObject"];
export const deepClone = utils.deepClone.bind(utils) as NodaliaUtilsApi["deepClone"];
export const getByPath = utils.getByPath.bind(utils) as NodaliaUtilsApi["getByPath"];
export const clamp = utils.clamp.bind(utils) as NodaliaUtilsApi["clamp"];
export const escapeHtml = utils.escapeHtml.bind(utils) as NodaliaUtilsApi["escapeHtml"];

export const buildGo2rtcViewerUrl = (baseUrl: unknown, streamName: unknown, mode?: unknown) => (
  window.NodaliaCameraStreamModel.buildGo2rtcViewerUrl(baseUrl, streamName, mode)
);
export const sanitizeIframeUrl = (rawValue: unknown) => (
  window.NodaliaCameraStreamModel.sanitizeIframeUrl(rawValue)
);
export const buildGo2rtcWebSocketEndpoint = (baseUrl: unknown, streamName: unknown) => (
  window.NodaliaCameraStreamModel.buildGo2rtcWebSocketEndpoint(baseUrl, streamName)
);
export const buildFrigateGo2rtcPath = (clientId: unknown, streamName: unknown) => (
  window.NodaliaCameraStreamModel.buildFrigateGo2rtcPath(clientId, streamName)
);
export const isMixedContentUrl = (rawValue: unknown, pageLocation?: Location) => (
  window.NodaliaCameraStreamModel.isMixedContentUrl(rawValue, pageLocation)
);
