import { CARD_TAG, CARD_VERSION, EDITOR_TAG } from "./room-summary-constants";
import {
  buildRoomSummary,
  hasRoomContent,
  hubMediaPlayerIds,
  normalizeConfig,
} from "./room-summary-config";
import {
  formatMetric,
  getState,
  normalizeEntityField,
} from "./room-summary-runtime";
import {
  hubAlarmEntityIds,
  hubSecurityEntityIds,
} from "./room-summary-helpers";
import { loadNodaliaRoomSummaryCard } from "./room-summary-card";
import { loadNodaliaRoomSummaryCardEditor } from "./room-summary-editor";
import type { RoomSummaryPublicApi } from "./room-summary-types";

window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, loadNodaliaRoomSummaryCard, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, loadNodaliaRoomSummaryCardEditor);

try {
  const lang = window.NodaliaI18n?.resolveLanguage?.(null, "auto") ?? "en";
  const pack = (window.NodaliaI18n?.strings?.(lang) as { roomSummaryCard?: { cardDescription?: string } } | undefined)?.roomSummaryCard
    ?? (window.NodaliaI18n?.strings?.("en") as { roomSummaryCard?: { cardDescription?: string } } | undefined)?.roomSummaryCard
    ?? {};
  window.NodaliaUtils?.registerCustomCard?.({
    type: CARD_TAG,
    name: "Nodalia Room Summary Card",
    description: String(pack.cardDescription || "Room overview for Nodalia dashboards."),
    preview: true,
  });
} catch {
  // Picker registration must never prevent the card custom element from loading.
}

const publicApi = {
  CARD_VERSION,
  normalizeConfig,
  normalizeEntityField,
  hubMediaPlayerIds,
  hubSecurityEntityIds,
  hubAlarmEntityIds,
  buildRoomSummary,
  hasRoomContent,
  formatMetric,
  getState,
} as RoomSummaryPublicApi;

const globalScope = globalThis as typeof globalThis & {
  __NODALIA_ROOM_SUMMARY__?: RoomSummaryPublicApi;
};

globalScope.__NODALIA_ROOM_SUMMARY__ = publicApi;
window.__NODALIA_ROOM_SUMMARY__ = publicApi;
