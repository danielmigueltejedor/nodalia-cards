import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./media-player-constants";
import { DEFAULT_CONFIG, normalizeConfig } from "./media-player-config";
import {
  extractArtworkPalette,
  MediaPlayerArtworkController,
  rememberRecentArtwork,
  resetArtworkLayers,
} from "./media-player-artwork";
import { interpolatePlaybackProgress, supportsMediaSeek } from "./media-player-progress";
import { resolvePresentationMode } from "./media-player-layout";
import { formatEditorJsonValue, parseEditorJsonObject } from "./media-player-helpers";
import { NodaliaMediaPlayer } from "./media-player-card";
import { NodaliaMediaPlayerEditor } from "./media-player-editor";
import type { MediaPlayerPublicApi } from "./media-player-types";

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, NodaliaMediaPlayer);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, NodaliaMediaPlayerEditor);
}

window.NodaliaUtils.registerCustomCard({
  type: CARD_TAG,
  name: "Nodalia Media Player",
  description: "This module turns your media player cards into the artwork of what is playing.",
  preview: true,
});

const publicApi = {
  CARD_TAG,
  EDITOR_TAG,
  CARD_VERSION,
  DEFAULT_CONFIG,
  normalizeConfig,
  formatEditorJsonValue,
  parseEditorJsonObject,
  resolvePresentationMode,
  interpolatePlaybackProgress,
  supportsMediaSeek,
  rememberRecentArtwork,
  extractArtworkPalette,
  resetArtworkLayers,
  MediaPlayerArtworkController,
};

window.__NODALIA_MEDIA_PLAYER__ = publicApi as MediaPlayerPublicApi;
