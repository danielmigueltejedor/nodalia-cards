export interface CameraPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  CAMERA_LAYOUT: string;
  CAMERA_PRESENTATION: string;
  MAX_CAMERAS: number;
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
  normalizeCameras: (config?: unknown) => string[];
  normalizeExpandedActions: (rawActions?: unknown) => unknown[];
  normalizeCameraActions: (rawActions?: unknown, cameraIds?: unknown) => unknown[];
  normalizeCameraTapActions: (rawActions?: unknown, cameraIds?: unknown) => unknown[];
  normalizeCameraStreams: (rawStreams?: unknown, cameraIds?: unknown) => unknown[];
  compactCameraTapActions: (rawActions?: unknown, globalTapConfig?: unknown) => unknown[];
  compactCameraStreams: (rawStreams?: unknown) => unknown[];
  buildGo2rtcViewerUrl: (baseUrl: unknown, streamName: unknown, mode?: unknown) => string;
  buildGo2rtcWebSocketEndpoint: (baseUrl: unknown, streamName: unknown) => string;
  buildFrigateGo2rtcPath: (clientId: unknown, streamName: unknown) => string;
  signHomeAssistantPath: (hass: unknown, path: unknown, expires?: unknown) => Promise<string>;
  resolveGo2rtcPlayerSource: (hass: unknown, streamConfig: unknown) => Promise<string>;
  isMixedContentUrl: (rawValue: unknown, pageLocation?: Location) => boolean;
  parseServiceData: (rawValue?: unknown) => Record<string, unknown>;
  formatRelativeAge: (timestamp?: unknown, locale?: unknown, now?: unknown) => string;
  stripEqualToDefaults: (config?: unknown, defaults?: unknown) => Record<string, unknown>;
  isUsableCameraAccessToken: (token?: unknown) => boolean;
  parseCameraProxyAuth: (url?: unknown) => { entityId: string; accessToken: string };
  appendQueryParam: (url: unknown, key: unknown, value: unknown) => string;
}
