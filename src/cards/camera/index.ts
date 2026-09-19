// Side-effect: register nodalia-go2rtc-player for standalone and HACS bundles.
import "../../../nodalia-go2rtc-player.js";
import {
  CAMERA_LAYOUT,
  CAMERA_PRESENTATION,
  CARD_TAG,
  CARD_VERSION,
  EDITOR_TAG,
  MAX_CAMERAS,
} from "./camera-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./camera-config";
import {
  appendQueryParam,
  compactCameraStreams,
  compactCameraTapActions,
  formatRelativeAge,
  isUsableCameraAccessToken,
  normalizeCameraActions,
  normalizeCameras,
  normalizeCameraStreams,
  normalizeCameraTapActions,
  normalizeExpandedActions,
  parseCameraProxyAuth,
  parseServiceData,
  resolveGo2rtcPlayerSource,
  signHomeAssistantPath,
  stripEqualToDefaults,
} from "./camera-helpers";
import {
  buildFrigateGo2rtcPath,
  buildGo2rtcViewerUrl,
  buildGo2rtcWebSocketEndpoint,
  isMixedContentUrl,
} from "./camera-runtime";
import { NodaliaCameraCard } from "./camera-card";
import { NodaliaCameraCardEditor } from "./camera-editor";
import type { CameraPublicApi } from "./camera-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaCameraCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaCameraCardEditor);
}

(function registerNodaliaCameraCardPicker() {
  try {
    const hass = window.NodaliaI18n?.resolveHass?.(null);
    const lang = window.NodaliaI18n?.resolveLanguage?.(hass, "auto") ?? "en";
    const pack = (window.NodaliaI18n?.strings?.(lang) as { cameraCard?: { cardDescription?: string } } | undefined)?.cameraCard
      ?? (window.NodaliaI18n?.strings?.("en") as { cameraCard?: { cardDescription?: string } } | undefined)?.cameraCard
      ?? {};
    const description = String(pack.cardDescription || "Nodalia-style camera preview with status chips and expanded view.");
    window.NodaliaUtils?.registerCustomCard?.({
      type: CARD_TAG,
      name: "Nodalia Camera Card",
      description,
      preview: true,
    });
  } catch {
    // Picker registration must never prevent the card custom element from loading.
  }
})();

const publicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  CAMERA_LAYOUT,
  CAMERA_PRESENTATION,
  MAX_CAMERAS,
  normalizeConfig,
  normalizeCameras,
  normalizeExpandedActions,
  normalizeCameraActions,
  normalizeCameraTapActions,
  normalizeCameraStreams,
  compactCameraTapActions,
  compactCameraStreams,
  buildGo2rtcViewerUrl,
  buildGo2rtcWebSocketEndpoint,
  buildFrigateGo2rtcPath,
  signHomeAssistantPath,
  resolveGo2rtcPlayerSource,
  isMixedContentUrl,
  parseServiceData,
  formatRelativeAge,
  stripEqualToDefaults,
  isUsableCameraAccessToken,
  parseCameraProxyAuth,
  appendQueryParam,
} as CameraPublicApi;

window.__NODALIA_CAMERA__ = publicApi;
if (typeof globalThis !== "undefined") {
  globalThis.__NODALIA_CAMERA__ = publicApi;
}
