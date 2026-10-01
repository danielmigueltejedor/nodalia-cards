export interface RoomSummaryPublicApi {
  CARD_VERSION: string;
  normalizeConfig: typeof import("./room-summary-config").normalizeConfig;
  normalizeEntityField: typeof import("./room-summary-model").normalizeEntityField;
  hubMediaPlayerIds: typeof import("./room-summary-config").hubMediaPlayerIds;
  hubSecurityEntityIds: typeof import("./room-summary-helpers").hubSecurityEntityIds;
  hubAlarmEntityIds: typeof import("./room-summary-helpers").hubAlarmEntityIds;
  buildRoomSummary: typeof import("./room-summary-config").buildRoomSummary;
  hasRoomContent: typeof import("./room-summary-config").hasRoomContent;
  formatMetric: typeof import("./room-summary-model").formatMetric;
  getState: typeof import("./room-summary-model").getState;
}
