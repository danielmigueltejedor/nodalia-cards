import type { NodaliaBackendApi } from "./engine";
import type { NodaliaUtilsApi } from "./nodalia-utils";
import type { ClimatePublicApi } from "../../cards/climate/climate-types";
import type { MediaPlayerPublicApi } from "../../cards/media-player/media-player-types";
import type { LightPublicApi } from "../../cards/light/light-types";
import type { FanPublicApi } from "../../cards/fan/fan-types";
import type { HumidifierPublicApi } from "../../cards/humidifier/humidifier-types";

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

declare global {
  interface Window {
    NodaliaUtils: NodaliaUtilsApi;
    NodaliaI18n?: NodaliaI18nApi;
    NodaliaBackend?: NodaliaBackendApi;
    NodaliaBubbleContrast?: NodaliaBubbleContrastApi;
    NodaliaRenderSignature?: NodaliaRenderSignatureApi;
    __NODALIA_CLIMATE__?: ClimatePublicApi;
    __NODALIA_MEDIA_PLAYER__?: MediaPlayerPublicApi;
    __NODALIA_LIGHT__?: LightPublicApi;
    __NODALIA_FAN__?: FanPublicApi;
    __NODALIA_HUMIDIFIER__?: HumidifierPublicApi;
  }

  var NodaliaUtils: NodaliaUtilsApi;
  var NodaliaI18n: NodaliaI18nApi | undefined;
  var NodaliaBackend: NodaliaBackendApi | undefined;
}

export {};
