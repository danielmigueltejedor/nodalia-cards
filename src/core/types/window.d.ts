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
import type { CalendarPublicApi } from "../../cards/calendar/calendar-types";
import type { PowerFlowPublicApi } from "../../cards/power-flow/power-flow-types";
import type {
  NotificationsMobilePublicApi,
  NotificationsPublicApi,
  NotificationsTemplatesPublicApi,
} from "../../cards/notifications/notifications-types";
import type { NavigationPublicApi } from "../../cards/navigation/navigation-types";
import type { RoomSummaryPublicApi } from "../../cards/room-summary/room-summary-types";
import type { AdvanceVacuumPublicApi } from "../../cards/advance-vacuum/advance-vacuum-types";

interface NodaliaI18nApi {
  translateEntityState?: (language: string, state: import("./home-assistant").HassEntity | null, decimals: number,
    formatWithUnit: (value: string, unit: string, decimals: number) => string,
    formatNumber: (value: string, decimals: number) => string, parseNumber: (value: unknown) => number | null) => unknown;
  translateFavState?: (language: string, key: string) => string;
  translateEntityStateChip?: (hass: unknown, language: string, key: string) => string;
  translateNewsUi?: (hass: unknown, language: string, key: string, fallback?: string, values?: Record<string, unknown>) => string;
  resolveHass?: (hass: unknown) => unknown;
  resolveLanguage?: (hass: unknown, language?: string) => string;
  strings?: (language: string) => Record<string, unknown>;
  editorStr?: (hass: unknown, language: string, key: string) => string;
  translateFanAria?: (hass: unknown, language: string, key: string, fallback?: string) => string;
  translateCommonAria?: (hass: unknown, language: string, key: string, fallback?: string) => string;
  translateWeatherForecastUi?: (hass: unknown, language: string, key: string) => string;
  translateWeatherCondition?: (hass: unknown, language: string, value: unknown) => string;
  translateMeteoalarmTerm?: (hass: unknown, language: string, value: unknown) => string;
  translateHumidifierMode?: (hass: unknown, language: string, value: unknown) => string;
  translateAdvanceVacuumVacuumMode?: (hass: unknown, language: string, value: unknown, kind?: string) => string;
  translateAdvanceVacuumReportedState?: (hass: unknown, language: string, key: unknown, fallback?: unknown) => string;
  translateVacuumErrorState?: (hass: unknown, language: string, value: unknown, fallback?: unknown) => string;
  isVacuumErrorState?: (value: unknown) => boolean;
  localeTag?: (language: string) => string;
}

type NodaliaBubbleContrastApi = Partial<typeof import("../../shared/bubble-contrast").bubbleContrast>;

type NodaliaRenderSignatureApi = typeof import("../../shared/render-signature").renderSignature;

type NodaliaNotificationsMobilePolicyApi = typeof import("../../cards/notifications/notifications-mobile-policy").notificationsMobilePolicy;

type NodaliaRoomSummaryModelApi = typeof import("../../cards/room-summary/room-summary-model").roomSummaryModel;

type NodaliaCameraStreamModelApi = typeof import("../../cards/camera/camera-stream-model").cameraStreamModel;

declare global {
  interface Window {
    hass?: import("./home-assistant").HomeAssistant;
    __NODALIA_LOCK__: Pick<typeof import("../../cards/lock/lock-config"), "CARD_TAG" | "EDITOR_TAG" | "CARD_VERSION" | "normalizeConfig">;
    NodaliaUtils: NodaliaUtilsApi;
    NodaliaI18n?: NodaliaI18nApi;
    NodaliaBackend?: NodaliaBackendApi;
    NodaliaBubbleContrast?: NodaliaBubbleContrastApi;
    NodaliaRenderSignature?: NodaliaRenderSignatureApi;
    NodaliaCameraStreamModel: NodaliaCameraStreamModelApi;
    NodaliaNotificationsMobilePolicy: NodaliaNotificationsMobilePolicyApi;
    NodaliaRoomSummaryModel: NodaliaRoomSummaryModelApi;
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
    __NODALIA_CALENDAR__?: CalendarPublicApi;
    __NODALIA_POWER_FLOW__?: PowerFlowPublicApi;
    __NODALIA_NOTIFICATIONS__?: NotificationsPublicApi;
    __NODALIA_NOTIFICATIONS_TEMPLATES__?: NotificationsTemplatesPublicApi;
    __NODALIA_NOTIFICATIONS_MOBILE__?: NotificationsMobilePublicApi;
    __NODALIA_NAVIGATION__?: NavigationPublicApi;
    __NODALIA_ROOM_SUMMARY__?: RoomSummaryPublicApi;
    __NODALIA_ADVANCE_VACUUM__?: AdvanceVacuumPublicApi;
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
