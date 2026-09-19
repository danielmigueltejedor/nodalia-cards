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
import { NodaliaEntityCard } from "./entity-card";
import { NodaliaEntityCardEditor } from "./entity-editor";
import type { EntityAirQualityPublicApi, EntityPublicApi } from "./entity-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaEntityCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaEntityCardEditor);
}

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
