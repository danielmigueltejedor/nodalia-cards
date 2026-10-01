export interface EntityPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: typeof import("./entity-config").normalizeConfig;
}

export type EntityAirQualityPublicApi = Pick<typeof import("./entity-constants"), "AIR_QUALITY_METRIC_KEYS" | "AIR_QUALITY_GRAPH_SERIES_COLORS" | "AIR_QUALITY_WHO_BANDS" | "AIR_QUALITY_COMFORT_KEYS">
  & Pick<typeof import("./entity-config"), "normalizeAirQualityBlock">
  & Pick<typeof import("./entity-helpers"), "resolveAirQualityLevelFromBands" | "resolveAirQualityLevelFromAqi" | "resolveMetricGuidelineBands" | "worseAirQualityLevel" | "parseAirQualityNumeric" | "buildAirQualitySmoothPath" | "buildAirQualityAreaPath" | "buildAirQualityChartGeometry" | "getAirQualityHoverPayload" | "buildAirQualityInterpolatedSamples">;
