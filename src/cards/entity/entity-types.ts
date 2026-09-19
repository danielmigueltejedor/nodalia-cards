export interface EntityPublicApi {
  CARD_TAG: string;
  EDITOR_TAG: string;
  CARD_VERSION: string;
  DEFAULT_CONFIG: Record<string, unknown>;
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
}

export interface EntityAirQualityPublicApi {
  AIR_QUALITY_METRIC_KEYS: readonly string[];
  AIR_QUALITY_GRAPH_SERIES_COLORS: Readonly<Record<string, string>>;
  AIR_QUALITY_WHO_BANDS: Record<string, unknown>;
  AIR_QUALITY_COMFORT_KEYS: Set<string>;
  normalizeAirQualityBlock: (raw?: unknown) => Record<string, unknown>;
  resolveAirQualityLevelFromBands: (value: unknown, bands: unknown) => unknown;
  resolveAirQualityLevelFromAqi: (value: unknown) => unknown;
  resolveMetricGuidelineBands: (kind: unknown, unit?: unknown) => unknown;
  worseAirQualityLevel: (left: unknown, right: unknown) => unknown;
  parseAirQualityNumeric: (value: unknown) => number | null;
  buildAirQualitySmoothPath: (points: unknown) => string;
  buildAirQualityAreaPath: (points: unknown, bottomY: unknown) => string;
  buildAirQualityChartGeometry: (seriesEntries?: unknown) => unknown;
  getAirQualityHoverPayload: (geometry: unknown, hoverState: unknown) => unknown;
  buildAirQualityInterpolatedSamples: (
    events: unknown,
    startMs: unknown,
    endMs: unknown,
    pointsCount: unknown,
    fallbackValue?: unknown,
  ) => unknown;
}
