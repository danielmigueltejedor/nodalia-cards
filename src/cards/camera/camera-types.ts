export interface CameraPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  CAMERA_LAYOUT: string;
  CAMERA_PRESENTATION: string;
  MAX_CAMERAS: number;
  normalizeConfig: typeof import("./camera-config").normalizeConfig;
  normalizeCameras: typeof import("./camera-helpers").normalizeCameras;
  normalizeExpandedActions: typeof import("./camera-helpers").normalizeExpandedActions;
  normalizeCameraActions: typeof import("./camera-helpers").normalizeCameraActions;
  normalizeCameraTapActions: typeof import("./camera-helpers").normalizeCameraTapActions;
  normalizeCameraStreams: typeof import("./camera-helpers").normalizeCameraStreams;
  compactCameraTapActions: typeof import("./camera-helpers").compactCameraTapActions;
  compactCameraStreams: typeof import("./camera-helpers").compactCameraStreams;
  buildGo2rtcViewerUrl: (baseUrl: unknown, streamName: unknown, mode?: unknown) => string;
  buildGo2rtcWebSocketEndpoint: (baseUrl: unknown, streamName: unknown) => string;
  buildFrigateGo2rtcPath: (clientId: unknown, streamName: unknown) => string;
  signHomeAssistantPath: typeof import("./camera-helpers").signHomeAssistantPath;
  resolveGo2rtcPlayerSource: typeof import("./camera-helpers").resolveGo2rtcPlayerSource;
  isMixedContentUrl: (rawValue: unknown, pageLocation?: Location) => boolean;
  parseServiceData: typeof import("./camera-helpers").parseServiceData;
  formatRelativeAge: typeof import("./camera-helpers").formatRelativeAge;
  stripEqualToDefaults: typeof import("./camera-helpers").stripEqualToDefaults;
  isUsableCameraAccessToken: typeof import("./camera-helpers").isUsableCameraAccessToken;
  parseCameraProxyAuth: typeof import("./camera-helpers").parseCameraProxyAuth;
  appendQueryParam: typeof import("./camera-helpers").appendQueryParam;
}
