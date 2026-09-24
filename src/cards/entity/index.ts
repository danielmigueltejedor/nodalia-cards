import {
  AIR_QUALITY_COMFORT_KEYS,
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_METRIC_KEYS,
  AIR_QUALITY_WHO_BANDS,
  CARD_TAG,
  CARD_VERSION,
  EDITOR_TAG,
} from "./entity-constants";
import { DEFAULT_CONFIG, normalizeAirQualityBlock, normalizeConfig } from "./entity-config";
import {
  buildAirQualityAreaPath,
  buildAirQualityChartGeometry,
  buildAirQualityInterpolatedSamples,
  buildAirQualitySmoothPath,
  getAirQualityHoverPayload,
  parseAirQualityNumeric,
  resolveAirQualityLevelFromAqi,
  resolveAirQualityLevelFromBands,
  resolveMetricGuidelineBands,
  worseAirQualityLevel,
} from "./entity-helpers";
import { loadNodaliaEntityCard } from "./entity-card";
import { loadNodaliaEntityCardEditor } from "./entity-editor";
import type { EntityAirQualityPublicApi, EntityPublicApi } from "./entity-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaEntityCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaEntityCardEditor);

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Entity Card",
  description: "Flexible entity card for state, details, and quick actions.",
  preview: true,
});

const publicApi: EntityPublicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
};

window.__NODALIA_ENTITY__ = publicApi;

window.__NODALIA_ENTITY_AIR_QUALITY__ = {
  AIR_QUALITY_METRIC_KEYS,
  AIR_QUALITY_GRAPH_SERIES_COLORS,
  AIR_QUALITY_WHO_BANDS,
  AIR_QUALITY_COMFORT_KEYS,
  normalizeAirQualityBlock,
  resolveAirQualityLevelFromBands,
  resolveAirQualityLevelFromAqi,
  resolveMetricGuidelineBands,
  worseAirQualityLevel,
  parseAirQualityNumeric,
  buildAirQualitySmoothPath,
  buildAirQualityAreaPath,
  buildAirQualityChartGeometry,
  getAirQualityHoverPayload,
  buildAirQualityInterpolatedSamples,
} as EntityAirQualityPublicApi;
