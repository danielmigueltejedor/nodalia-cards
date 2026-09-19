import type { NodaliaBackendApi } from "./engine";
import type { NodaliaUtilsApi } from "./nodalia-utils";
import type { ClimatePublicApi } from "../../cards/climate/climate-types";
import type { MediaPlayerPublicApi } from "../../cards/media-player/media-player-types";
import type { LightPublicApi } from "../../cards/light/light-types";
import type { FanPublicApi } from "../../cards/fan/fan-types";
import type { HumidifierPublicApi } from "../../cards/humidifier/humidifier-types";
import type { CoverPublicApi } from "../../cards/cover/cover-types";
import type { AlarmPanelPublicApi } from "../../cards/alarm-panel/alarm-panel-types";
import type { VacuumPublicApi } from "../../cards/vacuum/vacuum-types";
import type { EntityAirQualityPublicApi, EntityPublicApi } from "../../cards/entity/entity-types";
import type { FavPublicApi } from "../../cards/fav/fav-types";
import type { PersonPublicApi } from "../../cards/person/person-types";
import type { CameraPublicApi } from "../../cards/camera/camera-types";
import type { CircularGaugePublicApi } from "../../cards/circular-gauge/circular-gauge-types";
import type { InsigniaPublicApi } from "../../cards/insignia/insignia-types";
import type { ScenesPublicApi } from "../../cards/scenes/scenes-types";
import type { NewsPublicApi } from "../../cards/news/news-types";
import type { WeatherPublicApi } from "../../cards/weather/weather-types";
import type { GraphPublicApi } from "../../cards/graph/graph-types";

interface NodaliaI18nApi {
  resolveHass?: (hass: unknown) => unknown;
  resolveLanguage?: (hass: unknown, language?: string) => string;
  strings?: (language: string) => Record<string, unknown>;
  editorStr?: (hass: unknown, language: string, key: string) => string;
  localeTag?: (language: string) => string;
}

interface NodaliaBubbleContrastApi {
  resolveEditorColorValue?: (value: string) => string;
}

interface NodaliaRenderSignatureApi {
  joinParts?: (...parts: unknown[]) => string;
}

interface NodaliaCameraStreamModelApi {
  buildGo2rtcViewerUrl(baseUrl: unknown, streamName: unknown, mode?: unknown): string;
  sanitizeIframeUrl(rawValue: unknown): string;
  buildGo2rtcWebSocketEndpoint(baseUrl: unknown, streamName: unknown): string;
  buildFrigateGo2rtcPath(clientId: unknown, streamName: unknown): string;
  isMixedContentUrl(rawValue: unknown, pageLocation?: Location): boolean;
}

declare global {
  interface Window {
    NodaliaUtils: NodaliaUtilsApi;
    NodaliaI18n?: NodaliaI18nApi;
    NodaliaBackend?: NodaliaBackendApi;
    NodaliaBubbleContrast?: NodaliaBubbleContrastApi;
    NodaliaRenderSignature?: NodaliaRenderSignatureApi;
    NodaliaCameraStreamModel: NodaliaCameraStreamModelApi;
    __NODALIA_CLIMATE__?: ClimatePublicApi;
    __NODALIA_MEDIA_PLAYER__?: MediaPlayerPublicApi;
    __NODALIA_LIGHT__?: LightPublicApi;
    __NODALIA_FAN__?: FanPublicApi;
    __NODALIA_HUMIDIFIER__?: HumidifierPublicApi;
    __NODALIA_COVER__?: CoverPublicApi;
    __NODALIA_ALARM_PANEL__?: AlarmPanelPublicApi;
    __NODALIA_VACUUM__?: VacuumPublicApi;
    __NODALIA_ENTITY__?: EntityPublicApi;
    __NODALIA_ENTITY_AIR_QUALITY__?: EntityAirQualityPublicApi;
    __NODALIA_FAV__?: FavPublicApi;
    __NODALIA_PERSON__?: PersonPublicApi;
    __NODALIA_CAMERA__?: CameraPublicApi;
    __NODALIA_CIRCULAR_GAUGE__?: CircularGaugePublicApi;
    __NODALIA_INSIGNIA__?: InsigniaPublicApi;
    __NODALIA_SCENES__?: ScenesPublicApi;
    __NODALIA_NEWS__?: NewsPublicApi;
    __NODALIA_WEATHER__?: WeatherPublicApi;
    __NODALIA_GRAPH__?: GraphPublicApi;
    customCards?: Array<{ type?: string; [key: string]: unknown }>;
    customBadges?: Array<{
      type?: string;
      name?: string;
      preview?: boolean;
      description?: string;
      documentationURL?: string;
    }>;
  }

  var NodaliaUtils: NodaliaUtilsApi;
  var NodaliaI18n: NodaliaI18nApi | undefined;
  var NodaliaBackend: NodaliaBackendApi | undefined;
  var __NODALIA_CAMERA__: CameraPublicApi | undefined;
}

export {};
